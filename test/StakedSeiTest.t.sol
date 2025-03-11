// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.21;

import {Test} from "forge-std/Test.sol";

import {StakedSei} from "src/StakedSei.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StakedSeiTest is Test {
    StakedSei private s_stakedSei;
    address private s_owner;

    function setUp() public {
        s_owner = makeAddr("liquidStakingContract");
        string memory name = "StakedSei";
        string memory symbol = "SSEI";

        s_stakedSei = new StakedSei(s_owner, name, symbol);
    }

    function testTokenNameSymbolAndOwner() public {
        address liquidStakingContract = makeAddr("liquidStakingContract");
        string memory name = "StakedSei";
        string memory symbol = "SSEI";

        StakedSei stakedSei = new StakedSei(liquidStakingContract, name, symbol);

        assertEq(stakedSei.name(), name);
        assertEq(stakedSei.symbol(), symbol);
        assertEq(stakedSei.owner(), liquidStakingContract);
    }

    function testMintAccessControl() public {
        address random = makeAddr("random");
        uint256 amount = 100_000;

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        s_stakedSei.mint(random, amount);

        // vm.expectEmit(true, true, false, true, address(s_stakedSei));
        // emit IERC20.Transfer(address(0), random, amount);
        vm.prank(s_owner);
        s_stakedSei.mint(random, amount);

        assertEq(s_stakedSei.balanceOf(random), amount);
    }
}
