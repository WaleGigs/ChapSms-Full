// data/transactions.js
export const transactions = [
  {
    id: "TXN-1001",
    type: "Deposit",
    amount: "+$50.00",
    method: "Card Payment",
    status: "Successful",
    date: "Today",
  },
  {
    id: "TXN-1002",
    type: "Purchase",
    amount: "-$0.20",
    method: "Telegram OTP",
    status: "Completed",
    date: "Today",
  },
  {
    id: "TXN-1003",
    type: "Refund",
    amount: "+$0.18",
    method: "Failed OTP Order",
    status: "Returned",
    date: "Yesterday",
  },
  {
    id: "TXN-1004",
    type: "Purchase",
    amount: "-$0.35",
    method: "Google OTP",
    status: "Completed",
    date: "Yesterday",
  },
];