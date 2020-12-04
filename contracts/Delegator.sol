//SPDX-License-Identifier: Unlicense
pragma solidity >= 0.6.0 < 0.8.0;

import "./interfaces/aave/ILendingPoolAddressesProviderRegistry.sol";
import "./interfaces/aave/ILendingPoolAddressesProvider.sol";
import "./interfaces/aave/ILendingPool.sol";
import "./interfaces/aave/IProtocolDataProvider.sol";

import "./interfaces/common/IERC20.sol";


contract Delegator {
    // AAVE contracts
    ILendingPool public constant _lendingPool = ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9);
    IProtocolDataProvider public constant _dataProvider = IProtocolDataProvider(0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d);
    ILendingPoolAddressesProvider public constant _addressesProvider = ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
    ILendingPoolAddressesProviderRegistry public constant _addressesRegistry = ILendingPoolAddressesProviderRegistry(0x52D306e36E3B6B02c153d0266ff0f85d18BCD413);

    // ------------------------------------
    // Getters
    // ------------------------------------

    function getAddressesRegistry() public pure returns (address) {
        return address(_addressesRegistry);
    }

    function getAddressesProvider() public pure returns (address) {
        return address(_addressesProvider);
    }

    function getLendingPool() public pure returns (address) {
        return address(_lendingPool);
    }

    function getDataProvider() public pure returns (address) {
        return address(_dataProvider);
    }

    // ------------------------------------
    // Validation
    // ------------------------------------

    function validateAddressesProvider() public view returns (bool) {
        address[] memory providers = _addressesRegistry.getAddressesProvidersList();

        uint len = providers.length;
        for (uint i = 0; i < len; i++) {
            address provider = providers[i];

            if (provider == address(_addressesProvider)) {
                return true;
            }
        }

        return false;
    }



    // ------------------------------------
    // Execution
    // ------------------------------------

    // function delegateCredit(address from, address asset, uint amount, address to) public {

    // }

}
