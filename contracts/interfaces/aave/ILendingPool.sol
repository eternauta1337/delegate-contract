//SPDX-License-Identifier: Unlicense
pragma solidity >= 0.6.0 < 0.8.0;


interface ILendingPool {
  function getUserAccountData(address user)
    external
    view
    returns (
      uint256 totalCollateralETH,
      uint256 totalDebtETH,
      uint256 availableBorrowsETH,
      uint256 currentLiquidationThreshold,
      uint256 ltv,
      uint256 healthFactor
    );
}
