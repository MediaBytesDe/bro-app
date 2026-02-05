'use client';

import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
}

export function usePagination<T>(
  data: T[] | undefined,
  options: UsePaginationOptions = {}
) {
  const { initialPage = 1, pageSize = 20 } = options;
  const [currentPage, setCurrentPage] = useState(initialPage);

  const paginatedData = useMemo(() => {
    if (!data) return [];

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.length / pageSize);
  }, [data, pageSize]);

  const totalItems = data?.length || 0;

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => goToPage(currentPage + 1);
  const previousPage = () => goToPage(currentPage - 1);
  const resetPage = () => setCurrentPage(1);

  return {
    // Data
    data: paginatedData,
    // Pagination state
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    // Actions
    goToPage,
    nextPage,
    previousPage,
    resetPage,
  };
}
