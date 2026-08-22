import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrganizationDisciplineMatrix } from "./OrganizationDisciplineMatrix";
import { EMPTY_ORGANIZATION_DISCIPLINE_CONFIG } from "@/lib/organization-context";

describe("OrganizationDisciplineMatrix", () => {
  it("exposes organization-owned policy, matrix, precedent, CBA and approval inputs", () => {
    render(<OrganizationDisciplineMatrix config={{ ...EMPTY_ORGANIZATION_DISCIPLINE_CONFIG }} onChange={() => {}} />);
    expect(screen.getByText("Organization-configurable discipline matrix")).toBeInTheDocument();
    expect(screen.getByText("Your disciplinary / corrective-action matrix")).toBeInTheDocument();
    expect(screen.getByText("Anonymized comparable precedent")).toBeInTheDocument();
    expect(screen.getByText("CBA / union / due-process requirements")).toBeInTheDocument();
    expect(screen.getByText("Required approvals")).toBeInTheDocument();
  });

  it("returns a new config when an organization rule is edited", () => {
    const onChange = vi.fn();
    render(<OrganizationDisciplineMatrix config={{ ...EMPTY_ORGANIZATION_DISCIPLINE_CONFIG }} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Preponderance \/ more likely than not/i), { target: { value: "More likely than not" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ standardOfProof: "More likely than not" }));
  });
});
