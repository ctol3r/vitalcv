import { render, screen } from "@testing-library/react"
import { Skeleton, SkeletonCard, SkeletonList, SkeletonTable } from "@/components/ui/skeleton"

describe("Skeleton Components", () => {
  describe("Skeleton", () => {
    it("renders with default classes", () => {
      render(<Skeleton data-testid="skeleton" />)

      const skeleton = screen.getByTestId("skeleton")
      expect(skeleton).toHaveAttribute("data-slot", "skeleton")
      expect(skeleton).toHaveClass("bg-accent", "animate-pulse", "rounded-md")
    })

    it("accepts custom className", () => {
      render(<Skeleton className="h-4 w-full" data-testid="skeleton" />)

      const skeleton = screen.getByTestId("skeleton")
      expect(skeleton).toHaveClass("h-4", "w-full")
    })

    it("passes through other props", () => {
      render(<Skeleton data-testid="skeleton" role="status" />)

      const skeleton = screen.getByTestId("skeleton")
      expect(skeleton).toHaveAttribute("role", "status")
    })
  })

  describe("SkeletonCard", () => {
    it("renders card skeleton structure", () => {
      render(<SkeletonCard />)

      const skeletons = screen.getAllByRole("generic")
      expect(skeletons.length).toBeGreaterThan(1)
    })
  })

  describe("SkeletonList", () => {
    it("renders default number of items", () => {
      render(<SkeletonList />)

      const skeletons = screen.getAllByRole("generic")
      // Should have multiple skeleton elements for 3 items
      expect(skeletons.length).toBeGreaterThan(3)
    })

    it("renders custom number of items", () => {
      render(<SkeletonList items={5} />)

      const skeletons = screen.getAllByRole("generic")
      // Should have more skeleton elements for 5 items
      expect(skeletons.length).toBeGreaterThan(5)
    })
  })

  describe("SkeletonTable", () => {
    it("renders default table structure", () => {
      render(<SkeletonTable />)

      const skeletons = screen.getAllByRole("generic")
      // Should have skeletons for headers + rows * cols
      expect(skeletons.length).toBeGreaterThan(20) // 4 headers + 5 rows * 4 cols
    })

    it("renders custom table dimensions", () => {
      render(<SkeletonTable rows={2} cols={3} />)

      const skeletons = screen.getAllByRole("generic")
      // Should have 3 headers + 2 rows * 3 cols = 9 skeletons
      expect(skeletons.length).toBe(9)
    })
  })
})
