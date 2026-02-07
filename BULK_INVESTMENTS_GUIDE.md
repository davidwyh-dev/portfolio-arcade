# Bulk Investments Upload/Download Guide

## Overview

The bulk investments management feature allows you to easily export all your investments to a CSV file and import multiple investments from a CSV file. This feature includes comprehensive validation to prevent malformed data from being uploaded.

## Accessing the Feature

1. Navigate to the Investments section in your dashboard
2. Click the **BULK** button (with database icon) in the top right corner
3. A modal will open showing all your current investments

## Downloading Investments

1. Click the **DOWNLOAD CSV** button in the bulk management modal
2. A CSV file named `investments_YYYY-MM-DD.csv` will be downloaded to your computer
3. The file contains all your investments with the following columns:
   - ticker
   - accountName
   - dateAcquired
   - dateSold
   - units
   - unitPrice
   - soldUnitPrice
   - currency

## Uploading Investments

### CSV Format Requirements

Your CSV file must include the following headers (case-insensitive):
- **ticker** (required): Stock ticker symbol (e.g., AAPL, GOOGL)
- **accountName** (required): Name of an existing account in your portfolio
- **dateAcquired** (required): Date in YYYY-MM-DD format
- **dateSold** (optional): Date in YYYY-MM-DD format (leave empty if not sold)
- **units** (required): Number of shares/units (must be positive number)
- **unitPrice** (required): Purchase price per unit (must be positive number)
- **soldUnitPrice** (optional): Sale price per unit (leave empty if not sold)
- **currency** (required): 3-letter currency code (e.g., USD, EUR, GBP)

### Sample CSV

```csv
ticker,accountName,dateAcquired,dateSold,units,unitPrice,soldUnitPrice,currency
AAPL,Investment,2023-01-15,,100,150.50,,USD
GOOGL,Roth IRA,2023-02-20,,50,125.75,,USD
MSFT,Traditional 401k,2022-12-01,2023-06-15,75,280.00,320.50,USD
```

### Upload Steps

1. Click the **UPLOAD CSV** button in the bulk management modal
2. Select your CSV file from your computer
3. The system will validate the file and show:
   - **Success**: All investments are created and a success message is shown
   - **Validation Errors**: A detailed error report with:
     - Total number of validation errors
     - Error summary showing count of each error type
     - Detailed list of errors by row and field

### Validation Rules

The upload validation checks for:

1. **File Structure**
   - CSV file is not empty
   - All required headers are present

2. **Ticker**
   - Must not be empty
   - Automatically converted to uppercase

3. **Account Name**
   - Must not be empty
   - Must match an existing account in your portfolio

4. **Dates**
   - Must be in YYYY-MM-DD format
   - dateAcquired is required
   - dateSold is optional

5. **Units**
   - Must be a positive number
   - Cannot be empty

6. **Unit Price**
   - Must be a positive number
   - Cannot be empty

7. **Sold Unit Price**
   - Optional field
   - If provided, must be a positive number

8. **Currency**
   - Must be a 3-letter currency code
   - Automatically converted to uppercase

### Error Reporting

When validation fails, you'll see:

1. **Error Count**: Total number of validation errors found
2. **Error Summary**: Aggregated count of each type of error
   - Example: "×5 - unitPrice: Unit price must be a positive number"
3. **Detailed Errors**: Click "Show detailed errors" to see specific row-by-row errors
   - Shows up to 50 detailed errors
   - Format: "Row X: [field] error message"

### Tips for Successful Upload

1. **Prepare Your Accounts First**: Make sure all accounts referenced in your CSV already exist in your portfolio
2. **Use the Downloaded CSV as a Template**: Download your existing investments to get the correct format
3. **Check Date Formats**: Ensure all dates are in YYYY-MM-DD format
4. **Validate Numbers**: Make sure units and prices are positive numbers
5. **Review Error Summary**: If validation fails, check the error summary to quickly identify common issues

## Notes

- Uploads are processed in bulk but validated individually
- All validation errors must be fixed before the upload can succeed
- Successfully uploaded investments will not have current price data populated immediately
- Use the **REFRESH** button to fetch current market prices after upload
- The bulk upload feature does not update existing investments, it only creates new ones

## Sample File

A sample CSV file (`sample-investments.csv`) is included in the root directory of the project for reference.
