// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.21;

import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract StakedSei is ERC20Burnable, Ownable2Step {
    constructor(address liquidStakingContract, string memory name, string memory symbol)
        ERC20(name, symbol)
        Ownable(liquidStakingContract)
    {}

    // mint
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
