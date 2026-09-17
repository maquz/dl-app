import FormField from "./FormField.jsx";

export default function RegionDistrictSelect({
  regions,
  region,
  district,
  onRegionChange,
  onDistrictChange,
  regionError,
  districtError,
}) {
  const regionNames = Object.keys(regions);
  const districtOptions = region ? regions[region] || [] : [];
  const hasNoData = region && districtOptions.length === 0;

  return (
    <div className="field-row">
      <FormField label="Region" htmlFor="region" required error={regionError} hint="Select the name of your region here">
        <select
          id="region"
          value={region}
          onChange={(e) => {
            onRegionChange(e.target.value);
            onDistrictChange("");
          }}
          aria-invalid={!!regionError}
        >
          <option value="">Select a region…</option>
          {regionNames.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="District"
        htmlFor="district"
        required
        error={districtError}
        hint={
          hasNoData
            ? "District list for this region hasn't been loaded yet — type your district name below."
            : "You can only select the district when the region has been selected"
        }
      >
        {hasNoData ? (
          <input
            id="district"
            type="text"
            placeholder="Enter your district"
            value={district}
            onChange={(e) => onDistrictChange(e.target.value)}
            aria-invalid={!!districtError}
          />
        ) : (
          <select
            id="district"
            value={district}
            onChange={(e) => onDistrictChange(e.target.value)}
            disabled={!region}
            aria-invalid={!!districtError}
          >
            <option value="">{region ? "Select a district…" : "Select a region first"}</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </FormField>
    </div>
  );
}
