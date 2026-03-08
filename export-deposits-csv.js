#!/usr/bin/env node

/**
 * Export crypto casino deposits to CSV (multi-chain)
 * Import to Google Sheets or analyze locally
 */

const { exportDepositsToCsv } = require('./fetch-multichain');

exportDepositsToCsv().catch(console.error);
