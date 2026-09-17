export const ROLE_OPTIONS = [
  "DL District Trainer - Numeracy (Math)",
  "DL District Trainer - Literacy (English)",
  "DL District Trainer - IT Person (DL Dashboard)",
];

export default function RoleCheckboxGroup({ value, onChange, error }) {
  const selectedRole = Array.isArray(value) ? value[0] || "" : value || "";

  function handleSelect(role) {
    onChange([role]);
  }

  return (
    <fieldset className={`radio-group ${error ? "field-invalid" : ""}`} aria-describedby={error ? "roles-error" : undefined}>
      <legend>
        Which of the roles below have you been nominated for?
        <span className="required-mark" aria-hidden="true">
          {" "}
          *
        </span>
      </legend>
      {ROLE_OPTIONS.map((role) => (
        <label key={role} className="radio-option">
          <input
            type="radio"
            name="nominatedRole"
            value={role}
            checked={selectedRole === role}
            onChange={() => handleSelect(role)}
          />
          <span>{role}</span>
        </label>
      ))}
      {error && (
        <p className="field-error" id="roles-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
