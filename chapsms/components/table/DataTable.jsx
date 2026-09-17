"use client";

import { useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import TableSearch from "@/components/table/TableSearch";
import TableFilters from "@/components/table/TableFilters";
import EmptyState from "@/components/table/EmptyState";
import TablePagination from "@/components/table/TablePagination";
import SkeletonTable from "@/components/table/SkeletonTable";
export default function DataTable({
  title,
  description,
  columns = [],
  data = [],
  filters = [],
  searchPlaceholder = "Search...",
  emptyTitle = "No records found",
  emptyText = "Try adjusting your search or filters.",
  pageSize = 10,
  loading = false,
}) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  function handleFilterChange(key, value) {
    setFilterValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCurrentPage(1);
  }

  function handleSearchChange(value) {
    setSearch(value);
    setCurrentPage(1);
  }

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch = Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilters = Object.entries(filterValues).every(
        ([key, value]) => {
          if (!value || value === "all") return true;
          return String(row[key]).toLowerCase() === value.toLowerCase();
        }
      );

      return matchesSearch && matchesFilters;
    });
  }, [data, search, filterValues]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  function exportCSV() {
    const headers = columns.map((column) => column.header).join(",");
    const rows = filteredData
      .map((row) =>
        columns
          .map((column) => `"${String(row[column.accessor] ?? "")}"`)
          .join(",")
      )
      .join("\n");

    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${title?.toLowerCase() || "table"}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm">
            <RefreshCw size={16} />
            Refresh
          </Button>

          <Button onClick={exportCSV} variant="secondary" size="sm">
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <TableSearch
          value={search}
          onChange={handleSearchChange}
          placeholder={searchPlaceholder}
        />

        <TableFilters
          filters={filters}
          values={filterValues}
          onChange={handleFilterChange}
        />
      </div>

     {loading ? (
  <SkeletonTable rows={5} columns={columns.length} />
) : filteredData.length === 0 ? (
        <EmptyState title={emptyTitle} text={emptyText} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.accessor} className="whitespace-nowrap py-3">
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {paginatedData.map((row, rowIndex) => (
                  <tr
                    key={row.id || rowIndex}
                    className="border-b border-[var(--border)]"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.accessor}
                        className="whitespace-nowrap py-4 pr-6 font-medium text-[var(--foreground)]"
                      >
                        {column.cell
                          ? column.cell(row[column.accessor], row)
                          : row[column.accessor]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </Card>
  );
}