const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

const target = `    const cohortId = nominee?.cohortId || 1;
    Promise.all([
      fetchAssessments({ cohortId }),
      fetchResources().catch(() => ({ resources: [] })),
      import("../api").then(api => api.fetchMySubmissions(nominee?.phoneNumber, nominee?.id).catch(() => ({ submissions: [] })))
    ])`;

const replacement = `    const cohortId = nominee?.cohortId || 1;
    
    // Refresh nominee data in case tablet details or roles were updated by admin
    if (nominee?.phoneNumber || nominee?.email) {
      import("../api").then(api => {
        api.fetchMyNomination({ phone: nominee.phoneNumber, email: nominee.email })
          .then(res => {
            if (res.hasRegistered && res.nominee) {
              setNominee(res.nominee);
              localStorage.setItem("officer_profile", JSON.stringify(res.nominee));
              sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
            }
          })
          .catch(() => {});
      });
    }

    Promise.all([
      fetchAssessments({ cohortId }),
      fetchResources().catch(() => ({ resources: [] })),
      import("../api").then(api => api.fetchMySubmissions(nominee?.phoneNumber, nominee?.id).catch(() => ({ submissions: [] })))
    ])`;

if (code.includes(target)) {
  fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code.replace(target, replacement));
  console.log("Success updating useEffect");
} else {
  console.log("Target not found");
}
