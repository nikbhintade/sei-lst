// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.21;

import {Test, console2 as console} from "forge-std/Test.sol";

import {LiquidStaking} from "src/LiquidStaking.sol";
import {StakedSei} from "src/StakedSei.sol";

import {RevertsOnTransfer} from "test/helpers/RevertsOnTransfer.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract LiquidStakingTest is Test {
    address private s_owner;
    StakedSei private s_stakedSei;
    LiquidStaking private s_liquidStaking;

    function setUp() public {
        s_owner = makeAddr("s_owner");

        s_stakedSei = new StakedSei("StakedSei", "SSEI");

        s_liquidStaking = new LiquidStaking(address(s_stakedSei), s_owner);

        s_stakedSei.transferOwnership(address(s_liquidStaking));

        vm.prank(s_owner);
        s_liquidStaking.acceptOwnershipOfToken();
    }

    function testCorrectTokenOwner() public view {
        vm.assertEq(s_stakedSei.owner(), address(s_liquidStaking));
    }

    function testUserCanDeposit() public {
        uint256 amount = 10 ether;
        uint256 erc20TokenAmount = amount * s_liquidStaking.getExchangeRate();

        s_liquidStaking.deposit{value: amount}();

        assertEq(s_stakedSei.balanceOf(address(this)), erc20TokenAmount);
        assertEq(s_stakedSei.totalSupply(), erc20TokenAmount);
    }

    function testLSTOwnershipTransfer() public {
        address random = makeAddr("random");
        // transfer ownership
        s_liquidStaking.transferOwnershipOfToken(random);

        assertEq(s_stakedSei.pendingOwner(), random);
    }

    function testGrantOrRevokeRoles() public {
        address random = makeAddr("random");
        address bot = makeAddr("bot");

        vm.prank(s_owner);
        s_liquidStaking.setDelegationBot(bot);
        assertTrue(s_liquidStaking.hasRole(s_liquidStaking.DELEGATION_BOT(), bot));

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, random, bytes32(0))
        );
        vm.prank(random);
        s_liquidStaking.setDelegationBot(bot);

        vm.prank(s_owner);
        s_liquidStaking.removeDelegationBot(bot);
        assertFalse(s_liquidStaking.hasRole(s_liquidStaking.DELEGATION_BOT(), bot));

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, random, bytes32(0))
        );
        vm.prank(random);
        s_liquidStaking.removeDelegationBot(bot);
    }
}
