const fs = require('fs');
const file = '/Users/prathmesh/Documents/GitHub/veenolex/frontend/src/modules/admin/pages/SellerProductRequests.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'const handleApprove = async (requestId) => {',
    'const handleApprove = async (requestId, startDelivery = false) => {'
);
content = content.replace(
    'await approveRequest(requestId, adminNote);',
    'await approveRequest(requestId, adminNote, startDelivery);'
);

const oldButtons = `<button
                    onClick={() => handleApprove(request._id)}
                    disabled={actionLoading === request._id + "_approve"}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#27AE60",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {actionLoading === request._id + "_approve" ? "..." : "✅ Approve"}
                  </button>`;

const newButtons = `<button
                    onClick={() => handleApprove(request._id, false)}
                    disabled={actionLoading === request._id + "_approve"}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#27AE60",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {actionLoading === request._id + "_approve" ? "..." : "✅ Approve"}
                  </button>
                  <button
                    onClick={() => handleApprove(request._id, true)}
                    disabled={actionLoading === request._id + "_approve"}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#2980B9",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {actionLoading === request._id + "_approve" ? "..." : "🚚 Approve & Delivery"}
                  </button>`;

content = content.replace(oldButtons, newButtons);
fs.writeFileSync(file, content);
console.log("Patched SellerProductRequests.jsx");
