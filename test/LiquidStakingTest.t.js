const { expect } = require("chai");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Liquid staking contract", function () {
    async function LiquidStakingFixture() {
        const [temp, owner, user] = await hre.ethers.getSigners();

        const stakedSei = await hre.ethers.deployContract("StakedSei", [temp.address, "StakedSei", "SSEI"]);
        await stakedSei.waitForDeployment();


        const liquidStaking = await hre.ethers.deployContract("LiquidStaking", [owner.address]);
        await liquidStaking.waitForDeployment();

        await stakedSei.connect(temp).transferOwnership(liquidStaking.getAddress());

        await liquidStaking.connect(owner).acceptOwnershipOfToken();

        return { liquidStaking, stakedSei, owner, user };
    }
})