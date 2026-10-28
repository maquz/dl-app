import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  fetchSampleSchools,
  fetchSampleSchoolHierarchy,
  fetchSampleSchoolStats,
  fetchSampleSchoolParticipants,
} from "../api";

export default function SampleSchoolsAdminTab({ onBulkUpload, assessmentsList = [] }) {
  const [activeSubTab, setActiveSubTab] = useState("schools"); // 'schools' | 'participants'
  const [stats, setStats] = useState(null);
  const [hierarchy, setHierarchy] = useState({ regions: [], districtsByRegion: {} });

  // Active KPI Card filter tracking
  const [activeCardKey, setActiveCardKey] = useState(null);
  // 'all-schools' | 'all-staff' | 'headteachers' | 'teachers' | 'coverage' | 'group1' | 'group23'
  const [coverageFilter, setCoverageFilter] = useState(false); // Show only schools with registered staff

  // Schools list state
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  // Participants list state
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [selectedSchoolEmis, setSelectedSchoolEmis] = useState("");

  // Load initial data on mount
  useEffect(() => {
    loadStats();
    loadSchools();
    loadParticipants();
    fetchSampleSchoolHierarchy()
      .then(setHierarchy)
      .catch((err) => console.error("Error loading hierarchy:", err));
  }, []);

  // Reload schools when school-related filters change
  useEffect(() => {
    loadSchools();
  }, [regionFilter, districtFilter, groupFilter, schoolSearch]);

  // Reload participants when participant-related filters change
  useEffect(() => {
    loadParticipants();
  }, [regionFilter, districtFilter, groupFilter, designationFilter, participantSearch, selectedSchoolEmis]);

  async function loadStats() {
    try {
      const data = await fetchSampleSchoolStats();
      setStats(data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  }

  async function loadSchools() {
    setLoadingSchools(true);
    try {
      const data = await fetchSampleSchools({
        region: regionFilter,
        district: districtFilter,
        group_id: groupFilter,
        search: schoolSearch,
      });
      setSchools(data.schools || []);
    } catch (err) {
      console.error("Error loading sample schools:", err);
    } finally {
      setLoadingSchools(false);
    }
  }

  async function loadParticipants() {
    setLoadingParticipants(true);
    try {
      const data = await fetchSampleSchoolParticipants({
        region: regionFilter,
        district: districtFilter,
        group_id: groupFilter,
        designation: designationFilter,
        emis: selectedSchoolEmis,
        search: participantSearch,
      });
      setParticipants(data.participants || []);
    } catch (err) {
      console.error("Error loading participants:", err);
    } finally {
      setLoadingParticipants(false);
    }
  }

  function handleRegionChange(e) {
    setRegionFilter(e.target.value);
    setDistrictFilter("");
  }

  function handleResetAllFilters() {
    setActiveCardKey(null);
    setCoverageFilter(false);
    setSelectedSchoolEmis("");
    setRegionFilter("");
    setDistrictFilter("");
    setGroupFilter("");
    setDesignationFilter("");
    setSchoolSearch("");
    setParticipantSearch("");
  }

  // Card 1: Sample Schools (210)
  function handleCardClickSchools() {
    setActiveCardKey("all-schools");
    setActiveSubTab("schools");
    setCoverageFilter(false);
    setSelectedSchoolEmis("");
    setGroupFilter("");
    setDesignationFilter("");
    setRegionFilter("");
    setDistrictFilter("");
    setSchoolSearch("");
  }

  // Card 2: Staff Registered
  function handleCardClickStaff(designation = "") {
    if (designation === "Headteacher") {
      setActiveCardKey("headteachers");
      setDesignationFilter("Headteacher");
    } else if (designation === "Teacher") {
      setActiveCardKey("teachers");
      setDesignationFilter("Teacher");
    } else {
      setActiveCardKey("all-staff");
      setDesignationFilter("");
    }
    setActiveSubTab("participants");
    setCoverageFilter(false);
    setSelectedSchoolEmis("");
    setGroupFilter("");
    setRegionFilter("");
    setDistrictFilter("");
    setParticipantSearch("");
  }

  // Card 3: Schools Coverage (X/210)
  function handleCardClickCoverage() {
    if (activeCardKey === "coverage" && coverageFilter) {
      // Toggle off
      setCoverageFilter(false);
      setActiveCardKey(null);
    } else {
      setActiveCardKey("coverage");
      setActiveSubTab("schools");
      setCoverageFilter(true);
      setSelectedSchoolEmis("");
      setGroupFilter("");
      setRegionFilter("");
      setDistrictFilter("");
      setSchoolSearch("");
    }
  }

  // Card 4: Group 1 (Normal DL)
  function handleCardClickGroup1() {
    setActiveCardKey("group1");
    setGroupFilter("Group 1");
    setCoverageFilter(false);
    setSelectedSchoolEmis("");
    // If stats shows Group 1 registered staff, switch to participants to view them
    if (stats?.byGroup?.["Group 1"] > 0) {
      setActiveSubTab("participants");
    } else {
      setActiveSubTab("schools");
    }
  }

  // Card 5: Group 2 & Group 3 (T1 & T2)
  function handleCardClickGroup23() {
    setActiveCardKey("group23");
    setGroupFilter("Group 2,Group 3");
    setCoverageFilter(false);
    setSelectedSchoolEmis("");
    const tCount = (stats?.byGroup?.["Group 2"] || 0) + (stats?.byGroup?.["Group 3"] || 0);
    if (tCount > 0) {
      setActiveSubTab("participants");
    } else {
      setActiveSubTab("schools");
    }
  }

  // Drilldown from school to its registered staff
  function handleDrillDownSchoolStaff(school) {
    setSelectedSchoolEmis(school.emis_code);
    setActiveSubTab("participants");
    setActiveCardKey(`school-${school.emis_code}`);
    setParticipantSearch("");
    setDesignationFilter("");
  }

  // Filter schools for coverage view if active
  const displayedSchools = useMemo(() => {
    if (!coverageFilter) return schools;
    const coveredEmis = new Set(stats?.schoolEmisList || []);
    return schools.filter((s) => coveredEmis.has(s.emis_code));
  }, [schools, coverageFilter, stats]);

  // Determine active filter banner label
  const activeFilterLabel = useMemo(() => {
    if (selectedSchoolEmis) {
      const sch = schools.find((s) => s.emis_code === selectedSchoolEmis);
      return `School: ${sch ? sch.school_name : selectedSchoolEmis}`;
    }
    if (activeCardKey === "all-schools") return "All 210 Sample Schools";
    if (activeCardKey === "all-staff") return "All Registered Staff";
    if (activeCardKey === "headteachers") return "Registered Headteachers Only";
    if (activeCardKey === "teachers") return "Registered Teachers Only";
    if (activeCardKey === "coverage" || coverageFilter) return "Schools with Registered Staff Only";
    if (activeCardKey === "group1" || groupFilter === "Group 1") return "Group 1: Normal DL Coaching (70 Schools)";
    if (activeCardKey === "group23" || groupFilter === "Group 2,Group 3") return "Group 2 & Group 3: Treatment Arms T1 & T2 (140 Schools)";
    if (groupFilter) return `Study Group: ${groupFilter}`;
    if (designationFilter) return `Role: ${designationFilter}`;
    if (regionFilter) return `Region: ${regionFilter}${districtFilter ? ` · ${districtFilter}` : ""}`;
    return null;
  }, [activeCardKey, coverageFilter, selectedSchoolEmis, groupFilter, designationFilter, regionFilter, districtFilter, schools]);

  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Schools
    const schoolRows = schools.map((s, idx) => ({
      "S/N": idx + 1,
      "Region": s.region,
      "District": s.district,
      "EMIS Code": s.emis_code,
      "School Name": s.school_name,
      "Study Group": s.group_id,
      "Treatment Protocol": s.treatment,
      "Staff Registered": stats?.schoolCounts?.[s.emis_code] || 0,
    }));
    const wsSchools = XLSX.utils.json_to_sheet(schoolRows);
    XLSX.utils.book_append_sheet(wb, wsSchools, "Sample Schools (210)");

    // Sheet 2: Registered Participants
    const participantRows = participants.map((p, idx) => ({
      "S/N": idx + 1,
      "Reference Code": p.referenceCode,
      "Officer Name": p.officerName,
      "Sex": p.sex,
      "Phone Number": p.phoneNumber,
      "Designation": p.designation,
      "School Name": p.schoolName,
      "EMIS Code": p.emisCode,
      "Study Group": p.studyGroup,
      "Region": p.region,
      "District": p.district,
      "Registration Date": p.submittedAt,
    }));
    const wsParticipants = XLSX.utils.json_to_sheet(participantRows);
    XLSX.utils.book_append_sheet(wb, wsParticipants, "Registered Staff");

    XLSX.writeFile(wb, `GALOP_Sample_Schools_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const samplePreTest = assessmentsList.find(
    (a) => a.id === 4 || (a.target_program === "sample_school" && a.type === "Pre-Test")
  );
  const samplePostTest = assessmentsList.find(
    (a) => a.id === 5 || (a.target_program === "sample_school" && a.type === "Post-Test")
  );

  return (
    <div className="sample-schools-admin-container" style={{ padding: "0.5rem 0" }}>
      {/* Header Banner */}
      <div
        className="trainers-mgmt-header"
        style={{
          background: "linear-gradient(135deg, #1e293b, #0f172a)",
          color: "#ffffff",
          padding: "1.75rem",
          borderRadius: "14px",
          marginBottom: "1.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.25rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🏫</span>
            <span
              style={{
                fontSize: "0.82rem",
                background: "rgba(59, 130, 246, 0.3)",
                color: "#93c5fd",
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
                fontWeight: 700,
              }}
            >
              EXPERIMENTAL STUDY TRACK (210 SAMPLE SCHOOLS)
            </span>
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#ffffff" }}>
            GALOP AF2 Sample Schools Workshop Management
          </h2>
          <p style={{ margin: "0.35rem 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
            4 Regions · 12 Districts · 210 Public Primary Schools (70 per Arm) · Dates: 27th – 29th Oct 2026
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            style={{
              background: "#fef3c7",
              color: "#92400e",
              borderColor: "#fde68a",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
            onClick={() => {
              if (onBulkUpload && samplePreTest) {
                onBulkUpload(samplePreTest);
              } else if (onBulkUpload) {
                onBulkUpload({ id: 4, title: "GALOP AF2 Sample Schools: Pre-Training Assessment", type: "Pre-Test" });
              }
            }}
          >
            📥 Upload Pre-Test (Schools)
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{
              background: "#dcfce7",
              color: "#166534",
              borderColor: "#bbf7d0",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
            onClick={() => {
              if (onBulkUpload && samplePostTest) {
                onBulkUpload(samplePostTest);
              } else if (onBulkUpload) {
                onBulkUpload({ id: 5, title: "GALOP AF2 Sample Schools: Post-Training Assessment", type: "Post-Test" });
              }
            }}
          >
            📥 Upload Post-Test (Schools)
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ background: "#ffffff", color: "#0f172a", fontWeight: 700, fontSize: "0.85rem" }}
            onClick={handleExportExcel}
          >
            📊 Export Data (Excel)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid - Responsive, Clickable, and Connected to Data Views */}
      <div className="analytics-grid" style={{ marginBottom: "1.75rem" }}>
        {/* Card 1: 210 Schools */}
        <div
          className="kpi-card"
          onClick={handleCardClickSchools}
          title="Click to view all 210 Sample Schools Catalog"
          style={{
            borderLeft: "4px solid #3b82f6",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            background: activeCardKey === "all-schools" ? "#eff6ff" : undefined,
            boxShadow:
              activeCardKey === "all-schools"
                ? "0 4px 12px rgba(59, 130, 246, 0.25)"
                : "0 1px 3px rgba(0, 0, 0, 0.04)",
            outline: activeCardKey === "all-schools" ? "2px solid #3b82f6" : "none",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="kpi-label">Sample Schools</span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#2563eb",
                fontWeight: 700,
                background: "#dbeafe",
                padding: "0.15rem 0.45rem",
                borderRadius: "6px",
              }}
            >
              {activeCardKey === "all-schools" ? "Viewing ✓" : "Click to View"}
            </span>
          </div>
          <span className="kpi-val text-navy">210 Schools</span>
          <span className="kpi-hint">70 Group 1 · 70 Group 2 · 70 Group 3</span>
        </div>

        {/* Card 2: Staff Registered */}
        <div
          className="kpi-card"
          onClick={() => handleCardClickStaff("")}
          title="Click to view all registered staff"
          style={{
            borderLeft: "4px solid #10b981",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            background:
              activeCardKey === "all-staff" || activeCardKey === "headteachers" || activeCardKey === "teachers"
                ? "#f0fdf4"
                : undefined,
            boxShadow:
              activeCardKey === "all-staff" || activeCardKey === "headteachers" || activeCardKey === "teachers"
                ? "0 4px 12px rgba(16, 185, 129, 0.25)"
                : "0 1px 3px rgba(0, 0, 0, 0.04)",
            outline:
              activeCardKey === "all-staff" || activeCardKey === "headteachers" || activeCardKey === "teachers"
                ? "2px solid #10b981"
                : "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="kpi-label">Staff Registered</span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#16a34a",
                fontWeight: 700,
                background: "#dcfce7",
                padding: "0.15rem 0.45rem",
                borderRadius: "6px",
              }}
            >
              {activeSubTab === "participants" && !designationFilter ? "Viewing ✓" : "Click to View"}
            </span>
          </div>
          <span className="kpi-val text-green" style={{ color: "#16a34a" }}>
            {stats?.totalRegistered || 0}
          </span>
          <div
            className="kpi-hint"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.15rem" }}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleCardClickStaff("Headteacher");
              }}
              style={{
                cursor: "pointer",
                padding: "0.15rem 0.4rem",
                borderRadius: "4px",
                background: activeCardKey === "headteachers" ? "#ede9fe" : "#f1f5f9",
                color: activeCardKey === "headteachers" ? "#6d28d9" : "#334155",
                fontWeight: activeCardKey === "headteachers" ? 800 : 600,
                border: activeCardKey === "headteachers" ? "1px solid #c4b5fd" : "1px solid transparent",
              }}
              title="Click to filter by Headteachers"
            >
              {stats?.byDesignation?.headteachers || 0} Headteachers 🔍
            </span>
            <span>·</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleCardClickStaff("Teacher");
              }}
              style={{
                cursor: "pointer",
                padding: "0.15rem 0.4rem",
                borderRadius: "4px",
                background: activeCardKey === "teachers" ? "#ccfbf1" : "#f1f5f9",
                color: activeCardKey === "teachers" ? "#0f766e" : "#334155",
                fontWeight: activeCardKey === "teachers" ? 800 : 600,
                border: activeCardKey === "teachers" ? "1px solid #99f6e4" : "1px solid transparent",
              }}
              title="Click to filter by Teachers"
            >
              {stats?.byDesignation?.teachers || 0} Teachers 🔍
            </span>
          </div>
        </div>

        {/* Card 3: Schools Coverage */}
        <div
          className="kpi-card"
          onClick={handleCardClickCoverage}
          title="Click to filter schools with registered staff"
          style={{
            borderLeft: "4px solid #8b5cf6",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            background: coverageFilter || activeCardKey === "coverage" ? "#faf5ff" : undefined,
            boxShadow:
              coverageFilter || activeCardKey === "coverage"
                ? "0 4px 12px rgba(139, 92, 246, 0.25)"
                : "0 1px 3px rgba(0, 0, 0, 0.04)",
            outline: coverageFilter || activeCardKey === "coverage" ? "2px solid #8b5cf6" : "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="kpi-label">Schools Coverage</span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#7c3aed",
                fontWeight: 700,
                background: "#ede9fe",
                padding: "0.15rem 0.45rem",
                borderRadius: "6px",
              }}
            >
              {coverageFilter ? "Active Filter ✓" : "Click to Filter"}
            </span>
          </div>
          <span className="kpi-val text-navy">
            {stats?.schoolsRepresented || 0} / 210
          </span>
          <span className="kpi-hint">
            {stats?.coveragePct || 0}% of schools represented
          </span>
        </div>

        {/* Card 4: Group 1 (Normal DL) */}
        <div
          className="kpi-card"
          onClick={handleCardClickGroup1}
          title="Click to view Group 1 data"
          style={{
            borderLeft: "4px solid #f59e0b",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            background: groupFilter === "Group 1" ? "#fffbeb" : undefined,
            boxShadow:
              groupFilter === "Group 1"
                ? "0 4px 12px rgba(245, 158, 11, 0.25)"
                : "0 1px 3px rgba(0, 0, 0, 0.04)",
            outline: groupFilter === "Group 1" ? "2px solid #f59e0b" : "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="kpi-label">Group 1 (Normal DL)</span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#b45309",
                fontWeight: 700,
                background: "#fef3c7",
                padding: "0.15rem 0.45rem",
                borderRadius: "6px",
              }}
            >
              {groupFilter === "Group 1" ? "Viewing ✓" : "Click to View"}
            </span>
          </div>
          <span className="kpi-val" style={{ color: "#2563eb" }}>
            {stats?.byGroup?.["Group 1"] || 0} registered
          </span>
          <span className="kpi-hint">Status quo DL coaching · 70 Schools</span>
        </div>

        {/* Card 5: Group 2 (T1) & Group 3 (T2) */}
        <div
          className="kpi-card"
          onClick={handleCardClickGroup23}
          title="Click to view Group 2 & Group 3 treatment data"
          style={{
            borderLeft: "4px solid #ec4899",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            background: groupFilter === "Group 2,Group 3" ? "#fdf2f8" : undefined,
            boxShadow:
              groupFilter === "Group 2,Group 3"
                ? "0 4px 12px rgba(236, 72, 153, 0.25)"
                : "0 1px 3px rgba(0, 0, 0, 0.04)",
            outline: groupFilter === "Group 2,Group 3" ? "2px solid #ec4899" : "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="kpi-label">Group 2 (T1) & Group 3 (T2)</span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#be185d",
                fontWeight: 700,
                background: "#fce7f3",
                padding: "0.15rem 0.45rem",
                borderRadius: "6px",
              }}
            >
              {groupFilter === "Group 2,Group 3" ? "Viewing ✓" : "Click to View"}
            </span>
          </div>
          <span className="kpi-val" style={{ color: "#059669" }}>
            {(stats?.byGroup?.["Group 2"] || 0) + (stats?.byGroup?.["Group 3"] || 0)} registered
          </span>
          <span className="kpi-hint">Mandatory midterm & pacing · 140 Schools</span>
        </div>
      </div>

      {/* Active Filter Notification Banner */}
      {activeFilterLabel && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            padding: "0.65rem 1rem",
            borderRadius: "10px",
            marginBottom: "1.25rem",
            fontSize: "0.88rem",
            fontWeight: 600,
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span>🔍 Active Filter:</span>
            <span
              style={{
                background: "#ffffff",
                padding: "0.2rem 0.65rem",
                borderRadius: "999px",
                border: "1px solid #93c5fd",
                color: "#1d4ed8",
                fontWeight: 700,
              }}
            >
              {activeFilterLabel}
            </span>
            <span style={{ fontSize: "0.82rem", color: "#475569" }}>
              ({activeSubTab === "schools" ? `${displayedSchools.length} schools` : `${participants.length} staff`} showing)
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetAllFilters}
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#b91c1c",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.82rem",
              padding: "0.25rem 0.65rem",
              borderRadius: "6px",
            }}
          >
            ✕ Reset Filter (Show All)
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #e2e8f0", marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("schools")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: activeSubTab === "schools" ? "3px solid #2563eb" : "3px solid transparent",
            color: activeSubTab === "schools" ? "#2563eb" : "#64748b",
            cursor: "pointer",
          }}
        >
          🏫 210 Sample Schools Catalog ({displayedSchools.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("participants")}
          style={{
            padding: "0.75rem 1.25rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: activeSubTab === "participants" ? "3px solid #2563eb" : "3px solid transparent",
            color: activeSubTab === "participants" ? "#2563eb" : "#64748b",
            cursor: "pointer",
          }}
        >
          👥 Registered Staff ({participants.length})
        </button>
      </div>

      {/* Filters Toolbar */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "1rem",
          marginBottom: "1.5rem",
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <input
            type="search"
            placeholder={
              activeSubTab === "schools"
                ? "Search school name or EMIS code..."
                : "Search staff name, phone, school, EMIS..."
            }
            value={activeSubTab === "schools" ? schoolSearch : participantSearch}
            onChange={(e) => {
              if (activeSubTab === "schools") setSchoolSearch(e.target.value);
              else setParticipantSearch(e.target.value);
            }}
            style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div style={{ minWidth: "150px" }}>
          <select
            value={regionFilter}
            onChange={handleRegionChange}
            style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          >
            <option value="">All 4 Regions</option>
            {hierarchy.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {regionFilter && hierarchy.districtsByRegion[regionFilter] && (
          <div style={{ minWidth: "160px" }}>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            >
              <option value="">All Districts in {regionFilter}</option>
              {hierarchy.districtsByRegion[regionFilter].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ minWidth: "160px" }}>
          <select
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setActiveCardKey(null);
            }}
            style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          >
            <option value="">All Study Groups</option>
            <option value="Group 1">Group 1 (Normal DL)</option>
            <option value="Group 2">Group 2 (T1: Midterm Check)</option>
            <option value="Group 3">Group 3 (T2: Midterm + Pacing)</option>
            <option value="Group 2,Group 3">Group 2 & Group 3 (All Treatment Arms)</option>
          </select>
        </div>

        {activeSubTab === "participants" && (
          <div style={{ minWidth: "150px" }}>
            <select
              value={designationFilter}
              onChange={(e) => {
                setDesignationFilter(e.target.value);
                setActiveCardKey(null);
              }}
              style={{ width: "100%", padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            >
              <option value="">All Roles (Headteacher & Teacher)</option>
              <option value="Headteacher">Headteacher</option>
              <option value="Teacher">Teacher</option>
            </select>
          </div>
        )}

        {(regionFilter ||
          districtFilter ||
          groupFilter ||
          designationFilter ||
          schoolSearch ||
          participantSearch ||
          coverageFilter ||
          selectedSchoolEmis) && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleResetAllFilters}
            style={{ padding: "0.55rem 0.85rem", fontSize: "0.85rem", fontWeight: 700 }}
          >
            Clear Filters ✕
          </button>
        )}
      </div>

      {/* SUB-VIEW 1: SCHOOLS CATALOG */}
      {activeSubTab === "schools" && (
        <div className="table-wrap">
          <table className="assessments-admin-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>S/N</th>
                <th style={{ width: "12%" }}>EMIS Code</th>
                <th style={{ width: "26%" }}>School Name</th>
                <th style={{ width: "16%" }}>Region & District</th>
                <th style={{ width: "13%" }}>Study Group</th>
                <th style={{ width: "14%" }}>Registered Staff</th>
                <th style={{ width: "14%" }}>Treatment Protocol</th>
              </tr>
            </thead>
            <tbody>
              {loadingSchools && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    Loading sample schools…
                  </td>
                </tr>
              )}
              {!loadingSchools && displayedSchools.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No schools found matching your search or filters.
                  </td>
                </tr>
              )}
              {displayedSchools.map((s, idx) => {
                const registeredCount = stats?.schoolCounts?.[s.emis_code] || 0;
                return (
                  <tr key={s.id || s.emis_code}>
                    <td>{s.sn || idx + 1}</td>
                    <td>
                      <span
                        style={{
                          fontFamily: "monospace",
                          background: "#f1f5f9",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "6px",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {s.emis_code}
                      </span>
                    </td>
                    <td>
                      <strong>{s.school_name}</strong>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>{s.region}</span>
                        <span style={{ fontSize: "0.82rem", color: "#64748b" }}>{s.district}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "999px",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          background:
                            s.group_id === "Group 1"
                              ? "#dbeafe"
                              : s.group_id === "Group 2"
                              ? "#fef3c7"
                              : "#dcfce7",
                          color:
                            s.group_id === "Group 1"
                              ? "#1e40af"
                              : s.group_id === "Group 2"
                              ? "#92400e"
                              : "#166534",
                        }}
                      >
                        {s.group_id}
                      </span>
                    </td>
                    <td>
                      {registeredCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleDrillDownSchoolStaff(s)}
                          style={{
                            background: "#dcfce7",
                            color: "#166534",
                            border: "1px solid #86efac",
                            borderRadius: "999px",
                            padding: "0.25rem 0.6rem",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                          title="Click to view registered staff for this school"
                        >
                          🟢 {registeredCount} Staff (View)
                        </button>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>0 registered</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: "0.82rem", color: "#475569" }}>{s.treatment}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-VIEW 2: REGISTERED PARTICIPANTS */}
      {activeSubTab === "participants" && (
        <div className="table-wrap">
          <table className="assessments-admin-table">
            <thead>
              <tr>
                <th style={{ width: "13%" }}>Ref Code</th>
                <th style={{ width: "20%" }}>Staff Name & Sex</th>
                <th style={{ width: "12%" }}>Designation</th>
                <th style={{ width: "13%" }}>Phone Number</th>
                <th style={{ width: "24%" }}>School & EMIS</th>
                <th style={{ width: "18%" }}>Study Group</th>
              </tr>
            </thead>
            <tbody>
              {loadingParticipants && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Loading participants…
                  </td>
                </tr>
              )}
              {!loadingParticipants && participants.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No participants found matching the active filter.
                  </td>
                </tr>
              )}
              {participants.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="ref-tag" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                      {p.referenceCode}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <strong>{p.officerName}</strong>
                      <span style={{ fontSize: "0.82rem", color: "#64748b" }}>{p.sex}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "0.25rem 0.6rem",
                        borderRadius: "6px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        background: p.designation === "Headteacher" ? "#ede9fe" : "#ccfbf1",
                        color: p.designation === "Headteacher" ? "#6d28d9" : "#0f766e",
                      }}
                    >
                      {p.designation}
                    </span>
                  </td>
                  <td>
                    <a href={`tel:${p.phoneNumber}`} className="phone-link">
                      {p.phoneNumber}
                    </a>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <strong>{p.schoolName}</strong>
                      <span style={{ fontSize: "0.8rem", color: "#64748b", fontFamily: "monospace" }}>
                        EMIS: {p.emisCode} · {p.district}, {p.region}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.6rem",
                          borderRadius: "999px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          width: "fit-content",
                          background:
                            p.studyGroup === "Group 1"
                              ? "#dbeafe"
                              : p.studyGroup === "Group 2"
                              ? "#fef3c7"
                              : "#dcfce7",
                          color:
                            p.studyGroup === "Group 1"
                              ? "#1e40af"
                              : p.studyGroup === "Group 2"
                              ? "#92400e"
                              : "#166534",
                        }}
                      >
                        {p.studyGroup}
                      </span>
                      {p.treatment && (
                        <span style={{ fontSize: "0.74rem", color: "#64748b" }}>{p.treatment}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
