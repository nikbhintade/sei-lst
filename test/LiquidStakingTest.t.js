const { expect } = require("chai");
const { exec } = require("child_process");
const hre = require("hardhat");

const IAddrAbi = [
    "function associate(string memory v, string memory r, string memory s, string memory customMessage) external returns (string memory seiAddr, address evmAddr)",
    "function associatePubKey(string memory pubKeyHex) external returns (string memory seiAddr, address evmAddr)",
    "function getSeiAddr(address addr) external view returns (string memory response)",
    "function getEvmAddr(string memory addr) external view returns (address response)"
];

describe("Liquid Staking Contract", function () {
    function getPrivateKey(accountName) {
        return new Promise((resolve, reject) => {
            const command = `echo y | ~/go/bin/seid keys export ${accountName} --unsafe --unarmored-hex`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    return reject(`Error: ${error.message}`);
                }
                if (stderr) {
                    console.warn(`Warning: ${stderr}`);
                }

                const lines = stdout.trim().split("\n");
                const privateKey = lines[lines.length - 1].trim(); // The last line should contain the private key
                resolve(privateKey);
            });
        });
    }

    function getEvmAddressFromSeid(accountName) {
        return new Promise((resolve, reject) => {
            const command = `~/go/bin/seid keys show ${accountName}`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    return reject(`Error: ${error.message}`);
                }
                if (stderr) {
                    console.warn(`Warning: ${stderr}`);
                }

                const match = stdout.match(/evm_address:\s+(0x[0-9a-fA-F]+)/);
                if (match) {
                    resolve(match[1]);
                } else {
                    reject("EVM address not found");
                }
            });
        });
    }

    async function getAndVerifyPrivateKey(accountName) {
        try {
            const privateKey = await getPrivateKey(accountName);
            const wallet = new hre.ethers.Wallet(privateKey);
            const derivedAddress = wallet.address;

            const evmAddress = await getEvmAddressFromSeid(accountName);

            if (derivedAddress.toLowerCase() === evmAddress.toLowerCase()) {
                return privateKey;
            } else {
                console.log("❌ Addresses do not match!");
            }
        } catch (error) {
            console.error(error);
        }
    }

    let signers;
    let provider;
    let stakedSei;
    let liquidStaking;

    const logBalance = async (wallet, name) => {
        console.log(`Balance of the ${name}: ${await provider.getBalance(wallet.address)}`);
    };

    const sendFunds = async (sender, recipients, amount) => {
        for (const recipient of recipients) {
            await sender.sendTransaction({
                to: recipient.address,
                value: hre.ethers.parseEther(amount),
            });
        }
    };

    beforeEach(async function () {
        const RPC_URL = "http://localhost:8545";

        // Get signers
        signers = await hre.ethers.getSigners();
        const [owner, user, temp] = signers;

        // Set up provider
        provider = new hre.ethers.JsonRpcProvider(RPC_URL);

        // Initialize wallets
        const admin = new hre.ethers.Wallet(await getAndVerifyPrivateKey("admin"), provider);

        await logBalance(admin, "admin");

        // Send funds to owner, user, and temp
        await sendFunds(admin, [owner], "1000");

        // send sei from owner to other accounts
        await sendFunds(owner, [user, temp], "10");

        // Deploy token contract
        stakedSei = await hre.ethers.deployContract("StakedSei", ["StakedSei", "SSEI"], { signer: temp });
        await stakedSei.waitForDeployment();

        // Deploy staking contract
        liquidStaking = await hre.ethers.deployContract("LiquidStaking", [await stakedSei.getAddress(), owner.address], { signer: owner });
        await liquidStaking.waitForDeployment();

        await stakedSei.connect(temp).transferOwnership(await liquidStaking.getAddress());

        await liquidStaking.acceptOwnershipOfToken();
    });

    it("User can deposit and get correct amount of LST", async function () {
        // Deploy token contract
        const stakedSeiContract = await hre.ethers.deployContract("StakedSei", ["StakedSei", "SSEI"], { signer: temp });
        await stakedSeiContract.waitForDeployment();

        // Deploy staking contract
        const liquidStaking = await hre.ethers.deployContract("LiquidStaking", [await stakedSeiContract.getAddress(), owner.address], { signer: owner });
        await liquidStaking.waitForDeployment();

        const [owner, user, temp] = signers;

        const stakingContractAdress = await liquidStaking.getAddress();

        // assert for event 
        await expect(stakedSeiContract.connect(temp).transferOwnership(stakingContractAdress))
            .to.emit(stakedSeiContract, "OwnershipTransferStarted")
            .withArgs(temp.address, await liquidStaking.getAddress());


        const pendingOwner = await stakedSeiContract.pendingOwner();
        console.log(`Address of Pending Owner: ${pendingOwner}`);

        expect(pendingOwner).to.be.equal(stakingContractAdress, "Wrong Pending Owner");

        await liquidStaking.acceptOwnershipOfToken();

        const stakedSeiOwner = await stakedSeiContract.owner();

        expect(stakedSeiOwner).to.be.equal(stakingContractAdress, "Wrong Owner");

        await logBalance(temp, "temp");
        await logBalance(owner, "owner");
        await logBalance(user, "user");
    })
})