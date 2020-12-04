//SPDX-License-Identifier: Unlicense
pragma solidity >= 0.6.0 < 0.8.0;


interface IDebtToken {
  function approveDelegation(address delegatee, uint256 amount) external;
}
