//SPDX-License-Identifier: Unlicense
pragma solidity >= 0.6.0 < 0.8.0;

import "./interfaces/aave/ILendingPoolAddressesProviderRegistry.sol";
import "./interfaces/aave/ILendingPoolAddressesProvider.sol";
import "./interfaces/aave/ILendingPool.sol";
import "./interfaces/aave/IProtocolDataProvider.sol";

import "./interfaces/common/IERC20.sol";


contract Delegator {
    // ------------------------------------
    // Constant properties
    // ------------------------------------

    // AAVE contracts (mainnet)
    ILendingPool                          private constant _lendingPool       = ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9);
    IProtocolDataProvider                 private constant _dataProvider      = IProtocolDataProvider(0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d);
    ILendingPoolAddressesProvider         private constant _addressesProvider = ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
    ILendingPoolAddressesProviderRegistry private constant _addressesRegistry = ILendingPoolAddressesProviderRegistry(0x52D306e36E3B6B02c153d0266ff0f85d18BCD413);

    // ------------------------------------
    // State properties
    // ------------------------------------

    address private _lender;
    address private _borrower;

    // ------------------------------------
    // Constructor
    // ------------------------------------

    constructor(address lender, address borrower) {
        _lender = lender;
        _borrower = borrower;
    }

    // ------------------------------------
    // Modifiers
    // ------------------------------------

    modifier onlyLender {
        require(msg.sender == _lender, "Sender is not the lender");
        _;
    }

    modifier onlyBorrower {
        require(msg.sender == _borrower, "Sender is not the borrower");
        _;
    }

    // ------------------------------------
    // Mutative functions
    // ------------------------------------

    function depositCollateral(address asset, uint amount) public onlyLender {
        IERC20 token = IERC20(asset);

        // transfer asset from lender to this contract
        require(token.allowance(msg.sender, address(this)) >= amount, 'Insufficient allowance');
        token.safeTransferFrom(msg.sender, address(this), amount);

        // approve, and deposit asset in AAVE as collateral
        token.safeApprove(address(_lendingPool), amount);
        _lendingPool.deposit(
            asset,
            amount,
            address(this), // onBehalfOf
            0              // referralCode
        );
    }

    function withdrawCollateral(address asset, uint amount) public onlyLender {
        // withdraw all if no amount is specified
        uint amoutToWithdraw = amount;
        if (amoutToWithdraw == 0) {
            (address aTokenAddress,,) = _dataProvider.getReserveTokensAddresses(asset);
            amoutToWithdraw = IERC20(aTokenAddress).balanceOf(address(this));
        }

        // withdraw collateral from AAVE and forward to lender
        _lendingPool.withdraw(asset, amountToWithdraw, _lender);
    }

    function approveCreditDelegation(address asset, uint amount, bool variable) public onlyLender {
        // retrieve associated debt token
        (, address stableDebtTokenAddress, address variableDebtTokenAddress) = _dataProvider.getReserveTokensAddresses(asset);
        IDebtToken debtToken = variable ? IDebtToken(variableDebtTokenAddress) : IDebtToken(stableDebtTokenAddress);

        // approve credit delegation for borrower
        debtToken.approveDelegation(_borrower, amount);
    }

    function withdrawBalance(address asset) public onlyLender {
        IERC20 token = IERC20(asset);

        // transfer any balance that this contract may have to the lender
        token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }

    function borrowDelegatedCredit(address asset, uint amount, bool variable) public onlyBorrower {
        // borrow delegated credit
        _lendingPool.borrow(
            asset,
            amount,
            variable ? 2 : 1, // interestRateMode, stable = 1, variable = 2
            0,                // referralCode
            _lender           // delegator
        );
    }

    function repayDelegatedCredit(bool bariable) public {
        IERC20 token = IERC20(asset);

        // transfer asset from repayer to this contract
        token.safeTransferFrom(msg.sender, address(this), amount);

        // approve, and repay delegated credit
        token.safeApprove(address(_lendingPool), amount);
        _lendingPool.repay(
            asset,
            amount,
            variable ? 2 : 1, // rateMode , stable = 1, variable = 2
            address(this)     // onBehalfOf
        );
    }

    // ------------------------------------
    // View functions
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

}
