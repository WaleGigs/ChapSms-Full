// services/transactionService.js
import { transactions } from "@/data/transactions/transactions";

export const transactionService = {
  async getTransactions() {
    return transactions;
  },
};