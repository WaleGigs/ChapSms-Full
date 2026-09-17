"use client";

import Button from "@/components/ui/Button";

export default function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-between">
      <p className="text-sm text-[var(--muted-foreground)]">
        Page {currentPage} of {totalPages}
      </p>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </Button>

        {Array.from({ length: totalPages }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onPageChange(index + 1)}
            className={`h-10 w-10 rounded-xl font-bold transition ${
              currentPage === index + 1
                ? "bg-blue-600 text-white"
                : "border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--background)]"
            }`}
          >
            {index + 1}
          </button>
        ))}

        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}