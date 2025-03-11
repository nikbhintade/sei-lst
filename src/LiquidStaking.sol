// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.21;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IDistr, DISTR_CONTRACT} from "src/interfaces/precompiles/IDistr.sol";
import {IStaking, STAKING_CONTRACT} from "src/interfaces/precompiles/IStaking.sol";

import {StakedSei} from "src/StakedSei.sol";

contract LiquidStaking is Ownable2Step {
    /**
     * functions for users:
     * - deposit: user can call this function to deposit tokens and get
     * equivalent amount of LSTs back. [DONE DONE]
     * - withdraw: user can call this after the unbonding period is over.  [DONE DONE]
     * - createWithdrawRequest: user can create a undelegate request so bot can
     * remove some tokens from delegated validators based on the strategy.  [DONE DONE]
     *
     * functions for delegation bot:
     * - delegate
     * - redelegate
     *
     * - undelegate
     *
     * Access control functions:
     * - setBot
     * - removeBot
     *
     * Important but not sure which category:
     * - exchangeRate
     *
     */

    /**
     * - set StakedSei token address
     * - set owner
     * -
     */

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    mapping(address => WithdrawRequest[]) private s_withdrawRequests;
    StakedSei immutable s_stakedSei;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    uint256 public constant UNBONDING_PERIOD = 21 days;
    uint256 public constant TIME_BUFFER = 2 hours;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error LiquidStaking__TransferFailed(bytes data);
    error LiquidStaking__UnbondingInProgress(uint256 timeRemaining);

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    struct WithdrawRequest {
        uint256 amount;
        uint256 timestamp;
    }

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    constructor(address token, address owner) Ownable(owner) {
        s_stakedSei = StakedSei(token);
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice User deposits native Sei tokens to get back LST at current exchange rate.
    function deposit() external payable {
        s_stakedSei.mint(msg.sender, msg.value * _getExchangeRate());
    }

    /// @notice User create a withdraw request so they can get the staked tokens back with reward after the end of unbonding period.
    /// @dev This will push a request to an withdraw reuqests array
    /// @param amount Amount of LST users wants to redeem
    function createWithdrawRequest(uint256 amount) external {
        // transfer tokens account
        s_stakedSei.transferFrom(msg.sender, address(this), amount);

        // create request
        WithdrawRequest memory request =
            WithdrawRequest({amount: amount / _getExchangeRate(), timestamp: block.timestamp});

        // push to array
        s_withdrawRequests[msg.sender].push(request);
    }

    /// @notice Users withdraws native Sei token from the contract.
    /// @param index Index of withdraw request
    /// @dev This function allows users to withdraw native Sei tokens from the request they created and once the native tokens are removed the request is removed from the array.
    function withdraw(uint256 index) external {
        // copy the request
        WithdrawRequest memory request = s_withdrawRequests[msg.sender][index];

        // timestamp assertion
        uint256 withdrawTS = request.timestamp + UNBONDING_PERIOD + TIME_BUFFER;
        if (block.timestamp < withdrawTS) {
            revert LiquidStaking__UnbondingInProgress(withdrawTS - block.timestamp);
        }

        // remove the request
        uint256 len = s_withdrawRequests[msg.sender].length;
        s_withdrawRequests[msg.sender][index] = s_withdrawRequests[msg.sender][len - 1];
        s_withdrawRequests[msg.sender].pop();

        // send the tokens
        (bool success, bytes memory data) = msg.sender.call{value: (request.amount)}("");

        if (!success) revert LiquidStaking__TransferFailed(data);
    }

    /*//////////////////////////////////////////////////////////////
                            OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Allows contract to accept the ownership of LST contract.
    function acceptOwnershipOfToken() public onlyOwner {
        s_stakedSei.acceptOwnership();
    }

    /// @notice Allows contract to give ownership of LST to different address.
    function transferOwnershipOfToken() public onlyOwner {}

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getWithdrawRequest(address user, uint256 index) external view returns (WithdrawRequest memory) {
        return s_withdrawRequests[user][index];
    }

    function getWithdrawRequests(address user) external view returns (WithdrawRequest[] memory) {
        return s_withdrawRequests[user];
    }

    function getExchangeRate() external view returns (uint256) {
        return _getExchangeRate();
    }

    function _getTotalDelegatedAmount() internal view returns (uint256 totalDelegation) {
        // get rewards
        IDistr.Rewards memory rewards = DISTR_CONTRACT.rewards(address(this));

        // loop over the array and get delegation for each validator
        uint256 validatorCount = rewards.rewards.length;

        for (uint256 i = 0; i < validatorCount; i++) {
            IStaking.Delegation memory delegation =
                STAKING_CONTRACT.delegation(address(this), rewards.rewards[i].validator_address);
            totalDelegation += delegation.balance.amount;
        }
    }

    function _getExchangeRate() internal view returns (uint256 exchangeRate) {
        uint256 totalSupply = s_stakedSei.totalSupply();
        if (totalSupply == 0) {
            return 1;
        } else {
            exchangeRate = (_getTotalDelegatedAmount() * 1e18) / totalSupply;
        }
    }
}
