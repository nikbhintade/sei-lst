// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.21;

import {Test, console2 as console} from "forge-std/Test.sol";

import {LiquidStaking} from "src/LiquidStaking.sol";
import {StakedSei} from "src/StakedSei.sol";

import {RevertsOnTransfer} from "test/helpers/RevertsOnTransfer.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LiquidStakingTest is Test {
    address private s_owner;
    StakedSei private s_stakedSei;
    LiquidStaking private s_liquidStaking;

    function setUp() public {
        s_owner = makeAddr("s_owner");

        address tempTokenOwner = makeAddr("tempTokenOwner");
        s_stakedSei = new StakedSei(tempTokenOwner, "StakedSei", "SSEI");

        s_liquidStaking = new LiquidStaking(address(s_stakedSei), s_owner);

        vm.prank(tempTokenOwner);
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

        // vm.expectEmit(true, true, false, true, address(s_stakedSei));
        // emit IERC20.Transfer(address(1), address(this), erc20TokenAmount);
        s_liquidStaking.deposit{value: amount}();

        assertEq(s_stakedSei.balanceOf(address(this)), erc20TokenAmount);
        assertEq(s_stakedSei.totalSupply(), erc20TokenAmount);
    }

    modifier depositSei() {
        s_liquidStaking.deposit{value: 10 ether}();
        s_stakedSei.approve(address(s_liquidStaking), type(uint256).max);
        _;
    }

    function testCreateWithdrawRequest() public depositSei {
        uint256 withdrawalAmount = 5 ether;

        s_liquidStaking.createWithdrawRequest(withdrawalAmount);

        // len of request array
        LiquidStaking.WithdrawRequest[] memory requests = s_liquidStaking.getWithdrawRequests(address(this));
        assertEq(requests.length, 1);

        // withdraw request
        LiquidStaking.WithdrawRequest memory request = LiquidStaking.WithdrawRequest({
            amount: withdrawalAmount / s_liquidStaking.getExchangeRate(),
            timestamp: block.timestamp
        });
        assertEq(keccak256(abi.encode(requests[0])), keccak256(abi.encode(request)));
    }

    function testEarlyWithdrawalFails() public depositSei {
        uint256 withdrawalAmount = 5 ether;
        s_liquidStaking.createWithdrawRequest(withdrawalAmount);

        LiquidStaking.WithdrawRequest memory request = s_liquidStaking.getWithdrawRequest(address(this), 0);

        vm.warp(1 days);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidStaking.LiquidStaking__UnbondingInProgress.selector, 20 days + 2 hours + request.timestamp
            )
        );
        s_liquidStaking.withdraw(0);

        vm.warp(10 days);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiquidStaking.LiquidStaking__UnbondingInProgress.selector, 11 days + 2 hours + request.timestamp
            )
        );
        s_liquidStaking.withdraw(0);
    }

    function testSuccessfulWithdrawal() public depositSei {
        uint256 withdrawalAmount = 5 ether;
        s_liquidStaking.createWithdrawRequest(withdrawalAmount);

        LiquidStaking.WithdrawRequest memory request = s_liquidStaking.getWithdrawRequest(address(this), 0);

        vm.warp(s_liquidStaking.UNBONDING_PERIOD() + s_liquidStaking.TIME_BUFFER() + 1 hours);

        uint256 initialBalance = address(this).balance;

        s_liquidStaking.withdraw(0);

        assertEq(address(this).balance, initialBalance + request.amount);
    }

    fallback() external payable {}
    receive() external payable {}

    function testRevertsOnFailedTransfer() public {
        RevertsOnTransfer failure = new RevertsOnTransfer();

        vm.deal(address(failure), 100 ether);

        uint256 amount = 5 ether;

        vm.startPrank(address(failure));
        s_liquidStaking.deposit{value: amount}();

        s_stakedSei.approve(address(s_liquidStaking), type(uint256).max);

        s_liquidStaking.createWithdrawRequest(amount);

        vm.warp(s_liquidStaking.UNBONDING_PERIOD() + s_liquidStaking.TIME_BUFFER() + 1 hours);

        vm.expectRevert(abi.encodeWithSelector(LiquidStaking.LiquidStaking__TransferFailed.selector, bytes("")));
        s_liquidStaking.withdraw(0);

        vm.stopPrank();
    }
}
