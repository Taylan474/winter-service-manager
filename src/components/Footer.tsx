import "../styles/footer.css";
import { COMPANY_CONFIG } from "../lib/company-config";

// Footer Komponente 
export default function Footer() {
  // Jahr wird automatisch geupdated
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <p>
        © {currentYear} · Made by {COMPANY_CONFIG.name}
        <span className="developer-credit">
          (Developed by Taylan Özdabak)
        </span>
      </p>
    </footer>
  );
}