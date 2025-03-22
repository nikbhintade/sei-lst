const { expect } = require("chai");
const { exec } = require("child_process");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { sign } = require("crypto");

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
    let addrContract;

    beforeEach(async function () {
        const PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000001004";
        const RPC_URL = "http://localhost:8545";

        // Get signers
        signers = await hre.ethers.getSigners();
        const [owner, user, temp] = signers;

        // Load contract ABI
        const artifact = await hre.artifacts.readArtifact("IAddr");
        const addrIface = new hre.ethers.Interface(artifact.abi);

        // Set up provider
        const provider = new hre.ethers.JsonRpcProvider(RPC_URL);

        // Initialize wallets
        const admin = new hre.ethers.Wallet(await getAndVerifyPrivateKey("admin"), provider);
        const randomWallet = hre.ethers.Wallet.createRandom(provider);
        // Fund the random wallet
        await admin.call({
            to: randomWallet.address,
            value: hre.ethers.parseEther("10"),
        });

        // Encode calldata for associatePubKey
        const associateCalldata = addrIface.encodeFunctionData("associatePubKey", [randomWallet.signingKey.compressedPublicKey.slice(2)]);

        // Call associatePubKey
        const decodedResult = addrIface.decodeFunctionResult("associatePubKey", await provider.call({
            to: PRECOMPILE_ADDRESS,
            data: associateCalldata,
        }));
        console.log(`Return value of associatePubKey:`,  decodedResult);

        console.log(`Both address are same: ${randomWallet.address == decodedResult[1]}`);

        // try {
        //     // Encode calldata for getSeiAddr
        //     const getSeiAddrCalldata = addrIface.encodeFunctionData("getSeiAddr", [randomWallet.address]);
        //     const seiAddress = await provider.call({
        //         to: PRECOMPILE_ADDRESS,
        //         data: getSeiAddrCalldata,
        //     });
        //     console.log(`Sei Address: ${seiAddress}`);
        // } catch (error) {
        //     console.error(`-------------- Error --------------`);
        //     console.error(hre.ethers.toUtf8String(error.data));
        //     console.error(error);
        //     console.error(`-------------- Error Ends --------------`);
        // }

        const logBalance = async (wallet) => {
            console.log(`Balance of the address: ${await provider.getBalance(wallet.address)}`);
        };

        const sendFunds = async (sender, recipients, amount) => {
            for (const recipient of recipients) {
                await sender.sendTransaction({
                    to: recipient.address,
                    value: hre.ethers.parseEther(amount),
                });
            }
        };

        await logBalance(admin);

        // Send funds to owner, user, and temp
        await sendFunds(admin, [owner, user, temp], "10");

        // Deploy token contract
        stakedSei = await hre.ethers.deployContract("StakedSei", ["StakedSei", "SSEI"], { signer: temp });
        await stakedSei.waitForDeployment();

        // Deploy staking contract
        liquidStaking = await hre.ethers.deployContract("LiquidStaking", [await stakedSei.getAddress(), owner.address], { signer: owner });
        await liquidStaking.waitForDeployment();

    });

    it("User can deposit and get correct amount of LST", async function () {
        
        const [owner, user, temp] = signers;

        const tempEvmAddr = await temp.getAddress();
        console.log(`Address of temp signer: ${tempEvmAddr}`);

        const stakingContractAdress = await liquidStaking.getAddress();

        expect(await stakedSei.connect(temp).transferOwnership(stakingContractAdress))
            .to.emit(stakedSei, "OwnershipTransferStarted")
            .withArgs(temp.address, await liquidStaking.getAddress());

        expect(await stakedSei.pendingOwner()).to.be.equal(stakingContractAdress);

        // const trace = await provider.send("eth_getTransactionByHash", [tx.hash]);
        // console.log(trace)
        // // expect()
        // //     .to.emit(stakedSei, "OwnershipTransferStarted")
        // //     .withArgs(temp.address, await liquidStaking.getAddress());

        // console.log(`StakedSei Pending Owner: ${await stakedSei.pendingOwner()}`);

        // // create variable for amount 
        // let amount = hre.ethers.parseEther("5");

        // check emitted event
        // deposit Sei in the liquid staking contract
        // await expect(liquidStaking.connect(user).deposit())
        //     .to.emit(stakedSei, "Transfer")
        //     .withArgs(hre.ethers.ZeroAddress, user.address, amount);

        // check stakedSei balance of user
        // expect(await stakedSei.balanceOf(user.address)).to.be.equal(amount);
        // check totalSupply of Staked Sei

        // calculate the amount that will be received 
        // cuz first dpopsit will change the exchange rate 
        // so doing deposit again is important

        // do the deposit again

        // check stakedSei balance of user

        // check totalSupply of Staked Sei
    })
})