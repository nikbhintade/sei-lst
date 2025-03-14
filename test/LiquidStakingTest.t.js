const { expect } = require("chai");
const { exec } = require("child_process");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

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

    async function LiquidStakingFixture() {
        const [first] = await hre.ethers.getSigners();

        let provider = new hre.ethers.JsonRpcProvider("http://localhost:8545");
        const user = new hre.ethers.Wallet(await getAndVerifyPrivateKey("ta0"), provider);
        const owner = new hre.ethers.Wallet(await getAndVerifyPrivateKey("ta1"), provider);
        const temp = new hre.ethers.Wallet(await getAndVerifyPrivateKey("ta2"), provider);

        console.log(`User Address: ${user.address}`);
        console.log(`Owner Address: ${owner.address}`);
        console.log(`Temporary Wallet Address: ${temp.address}`);

        const stakedSei = await hre.ethers.deployContract("StakedSei", ["StakedSei", "SSEI"], { signer: temp });
        await stakedSei.waitForDeployment();

        console.log(`StakedSei Contract Deployed at: ${await stakedSei.getAddress()}`);

        console.log(`Addres of default signer of hardhat: ${first.address}`)
        console.log(`StakedSei Contract Owner: ${await stakedSei.owner()}`);

        const liquidStaking = await hre.ethers.deployContract("LiquidStaking", [await stakedSei.getAddress(), owner.address], { signer: owner });
        await liquidStaking.waitForDeployment();

        console.log(`LiquidStaking Contract Deployed at: ${await liquidStaking.getAddress()}`);
        console.log(`LiquidStaking Contract Owner: ${await liquidStaking.owner()}`);



        // await liquidStaking.connect(owner).acceptOwnershipOfToken();
        // console.log(`Ownership Transfer Accepted: LiquidStaking now owns StakedSei`);


        return { stakedSei, liquidStaking, temp, owner, user, provider };
    }

    it("User can deposit and get correct amount of LST", async function () {
        const { stakedSei, liquidStaking, temp, owner, provider } = await loadFixture(LiquidStakingFixture);

        let tx = await stakedSei.connect(temp).transferOwnership(await liquidStaking.getAddress());

        const trace = await provider.send("eth_getTransactionByHash", [tx.hash]);
        console.log(trace)
        // expect()
        //     .to.emit(stakedSei, "OwnershipTransferStarted")
        //     .withArgs(temp.address, await liquidStaking.getAddress());

        console.log(`StakedSei Pending Owner: ${await stakedSei.pendingOwner()}`);

        // create variable for amount 
        let amount = hre.ethers.parseEther("5");

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