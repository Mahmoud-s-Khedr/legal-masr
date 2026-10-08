import {
  useMemo,
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
  type ComponentProps,
  type HTMLAttributes,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '../ui/table';
import { Button } from '../ui/button';
import { Pagination, PaginationContent, PaginationItem } from '../ui/pagination';

type Element = ReactElement<HTMLAttributes<HTMLElement>>;
const elements = (nodes: ReactNode) => Children.toArray(nodes).filter(isValidElement) as Element[];
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement(child) ? text((child as Element).props.children) : String(child),
    )
    .join(' ');
}
type RecordRow = { element: Element; cells: Element[] };
/** Record tables share sorting and 25-row local pagination, preserving links and row actions. */
export function RecordTable({ children, className, ...props }: ComponentProps<'table'>) {
  const { t } = useTranslation();
  const { headers, rows } = useMemo(() => {
    const sections = elements(children);
    const head = sections.find((e) => e.type === 'thead');
    const body = sections.find((e) => e.type === 'tbody');
    const headers = elements(elements(head?.props.children)[0]?.props.children);
    const rows: RecordRow[] = elements(body?.props.children).map((element) => ({
      element,
      cells: elements(element.props.children),
    }));
    return { headers, rows };
  }, [children]);
  const caption = elements(children).find((e) => e.type === 'caption');
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () =>
      headers.map((header, index) => ({
        id: String(index),
        accessorFn: (row) => text(row.cells[index]?.props.children),
        header: () => header.props.children,
        cell: (ctx) => ctx.row.original.cells[index]?.props.children,
        sortingFn: 'alphanumeric',
      })),
    [headers],
  );
  // TanStack manages controlled table internals; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
    autoResetPageIndex: true,
  });
  return (
    <>
      <Table {...props} className={className}>
        {caption && <TableCaption>{caption.props.children}</TableCaption>}
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={
                    header.column.getIsSorted() === 'asc'
                      ? 'ascending'
                      : header.column.getIsSorted() === 'desc'
                        ? 'descending'
                        : 'none'
                  }
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'
                      ? ' ↑'
                      : header.column.getIsSorted() === 'desc'
                        ? ' ↓'
                        : ''}
                  </Button>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.original.element.key ?? row.id}
              onClick={row.original.element.props.onClick}
              className={row.original.element.props.className}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} {...row.original.cells[Number(cell.column.id)]?.props}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 25 && (
        <Pagination aria-label={t('table.pagination')}>
          <PaginationContent>
            <PaginationItem>
              <Button
                type="button"
                variant="outline"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                {t('table.previous')}
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span>
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                type="button"
                variant="outline"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                {t('table.next')}
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
}
