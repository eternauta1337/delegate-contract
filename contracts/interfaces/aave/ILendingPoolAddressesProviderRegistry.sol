//SPDX-License-Identifier: Unlicensed
pragma solidity >= 0.6.0 < 0.8.0;


interface ILendingPoolAddressesProviderRegistry {
    function getAddressesProvidersList() external view returns (address[] memory);
}
