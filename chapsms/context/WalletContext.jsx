"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { walletService } from "@/services/walletService";

const WalletContext =
  createContext(null);

export function WalletProvider({
  children,
}) {
  const [wallet, setWallet] =
    useState(null);

  const [
    walletTransactions,
    setWalletTransactions,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const refreshWallet =
    useCallback(async () => {
      try {
        setLoading(true);

        const [
          walletData,
          transactionsData,
        ] = await Promise.all([
          walletService.getWallet(),
          walletService.getTransactions(),
        ]);

        setWallet(walletData || null);

        setWalletTransactions(
          Array.isArray(
            transactionsData
          )
            ? transactionsData
            : walletData?.transactions ||
                []
        );

        return walletData;
      } catch (error) {
        console.error(
          "Wallet loading failed:",
          error
        );

        throw error;
      } finally {
        setLoading(false);
      }
    }, []);

  const fundWallet =
    useCallback(async (amount) => {
      const updatedWallet =
        await walletService.fundWallet(
          amount
        );

      setWallet(
        updatedWallet || null
      );

      setWalletTransactions(
        updatedWallet?.transactions ||
          []
      );

      return updatedWallet;
    }, []);

  const updateWalletBalance =
    useCallback((balance) => {
      const numericBalance =
        Number(balance);

      if (
        !Number.isFinite(
          numericBalance
        )
      ) {
        console.error(
          "Invalid wallet balance:",
          balance
        );

        return;
      }

      setWallet(
        (currentWallet) => ({
          ...(currentWallet || {}),
          balance: numericBalance,
        })
      );
    }, []);

  useEffect(() => {
    refreshWallet().catch(() => {});
  }, [refreshWallet]);

  const contextValue = useMemo(
    () => ({
      wallet,
      walletTransactions,
      loading,
      fundWallet,
      refreshWallet,
      updateWalletBalance,
    }),
    [
      wallet,
      walletTransactions,
      loading,
      fundWallet,
      refreshWallet,
      updateWalletBalance,
    ]
  );

  return (
    <WalletContext.Provider
      value={contextValue}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(
    WalletContext
  );

  if (!context) {
    throw new Error(
      "useWalletContext must be used inside WalletProvider"
    );
  }

  return context;
}