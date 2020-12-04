//SPDX-License-Identifier: Unlicense
pragma solidity >=0.6.0 <0.8.0;

import "./interfaces/aave/IDebtToken.sol";
import "./interfaces/aave/ILendingPool.sol";
import "./interfaces/aave/IProtocolDataProvider.sol";
import "./interfaces/common/IERC20.sol";
import "./libraries/SafeERC20.sol";

// Aave Credit Delegation documentation: https://docs.aave.com/developers/v/2.0/guides/credit-delegation

contract Delegator {
    using SafeERC20 for IERC20;

    // ------------------------------------
    // Aave contracts (mainnet)
    // https://docs.aave.com/developers/v/2.0/deployed-contracts
    // ------------------------------------

    // https://etherscan.io/address/0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9
    ILendingPool public constant lendingPool =
        ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9);

    // https://etherscan.io/address/0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d
    IProtocolDataProvider public constant dataProvider =
        IProtocolDataProvider(0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d);

    // ------------------------------------
    // Constructor
    // ------------------------------------

    constructor(address lender, address borrower) {
        lender = lender;
        borrower = borrower;
    }

    // ------------------------------------
    // Lender specific
    // ------------------------------------

    address public lender;

    modifier onlyLender {
        require(msg.sender == lender, "Sender is not the lender");
        _;
    }

    function depositCollateral(address asset, uint256 amount)
        external
        onlyLender
    {
        IERC20 token = IERC20(asset);

        // transfer asset from lender to this contract
        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "Insufficient allowance"
        );
        token.safeTransferFrom(msg.sender, address(this), amount);

        // approve, and deposit asset in AAVE as collateral
        token.safeApprove(address(lendingPool), amount);
        lendingPool.deposit(
            asset,
            amount,
            address(this), // onBehalfOf
            0 // referralCode
        );
    }

    function withdrawCollateral(address asset, uint256 amount)
        external
        onlyLender
    {
        // withdraw all if no amount is specified
        uint256 amountToWithdraw = amount;
        if (amountToWithdraw == 0) {
            address depositTokenAddress =
                getAssociatedDepositTokenAddress(asset);
            amountToWithdraw = IERC20(depositTokenAddress).balanceOf(
                address(this)
            );
        }

        // withdraw collateral from AAVE and forward to lender
        lendingPool.withdraw(asset, amountToWithdraw, lender);
    }

    function approveCreditDelegation(
        address asset,
        uint256 amount,
        bool variable
    ) external onlyLender {
        // retrieve associated debt token address
        address debtTokenAddress =
            getAssociatedDebtTokenAddress(asset, variable);

        // approve credit delegation for borrower
        IDebtToken(debtTokenAddress).approveDelegation(borrower, amount);
    }

    function withdrawBalance(address asset) external onlyLender {
        IERC20 token = IERC20(asset);

        // transfer any balance that this contract may have to the lender
        token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }

    // ------------------------------------
    // Borrower specific
    // ------------------------------------

    address public borrower;

    modifier onlyBorrower {
        require(msg.sender == borrower, "Sender is not the borrower");
        _;
    }

    function borrowDelegatedCredit(
        address asset,
        uint256 amount,
        bool variable
    ) external onlyBorrower {
        // borrow delegated credit
        lendingPool.borrow(
            asset,
            amount,
            variable ? 2 : 1, // interestRateMode, stable = 1, variable = 2
            0, // referralCode
            lender // delegator
        );
    }

    function repayDelegatedCredit(
        address asset,
        uint256 amount,
        bool variable
    ) external {
        IERC20 token = IERC20(asset);

        // transfer asset from repayer to this contract
        token.safeTransferFrom(msg.sender, address(this), amount);

        // approve, and repay delegated credit
        token.safeApprove(address(lendingPool), amount);
        lendingPool.repay(
            asset,
            amount,
            variable ? 2 : 1, // rateMode , stable = 1, variable = 2
            address(this) // onBehalfOf
        );
    }

    // ------------------------------------
    // Utilities
    // ------------------------------------

    function getUserData(address user)
        external
        view
        returns (
            uint256 totalCollateralETH,
            uint256 totalDebtETH,
            uint256 availableBorrowsETH,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        return lendingPool.getUserAccountData(user);
    }

    function getAssetData(address asset)
        public
        view
        returns (
            uint256 decimals,
            uint256 ltv,
            uint256 liquidationThreshold,
            uint256 liquidationBonus,
            uint256 reserveFactor,
            bool usageAsCollateralEnabled,
            bool borrowingEnabled,
            bool stableBorrowRateEnabled,
            bool isActive,
            bool isFrozen
        )
    {
        return dataProvider.getReserveConfigurationData(asset);
    }

    function isAssetAvailableForDelegation(address asset)
        external
        view
        returns (bool)
    {
        (, uint256 ltv, , , , , , , bool isActive, bool isFrozen) =
            getAssetData(asset);

        return isActive && !isFrozen && ltv > 0;
    }

    function getDelegatedCreditAllowance(address asset, bool variable)
        external
        view
        returns (uint256)
    {
        IDebtToken debtToken = IDebtToken(getAssociatedDebtTokenAddress(asset, variable));

        return debtToken.borrowAllowance(lender, borrower);
    }

    function getAssociatedDebtTokenAddress(address asset, bool variable)
        public
        view
        returns (address)
    {
        (, address stableDebtTokenAddress, address variableDebtTokenAddress) =
            dataProvider.getReserveTokensAddresses(asset);

        return variable ? variableDebtTokenAddress : stableDebtTokenAddress;
    }

    function getAssociatedDepositTokenAddress(address asset)
        public
        view
        returns (address)
    {
        (address depositTokenAddress, , ) =
            dataProvider.getReserveTokensAddresses(asset);

        return depositTokenAddress;
    }
}
