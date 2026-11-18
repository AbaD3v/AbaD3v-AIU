import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { SiteName } from "./components/sql/site-name";
export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <Search size={40} />
        <span className="eyebrow"><SiteName nameKey="notFound.eyebrow" /></span>
        <h1><SiteName nameKey="notFound.heading" /></h1>
        <p>
          Возможно, ссылка устарела или в адресе есть опечатка. Вернитесь к
          списку заданий, чтобы продолжить практику.
        </p>
        <Link href="/" className="button button-primary">
          <ArrowLeft size={16} /><SiteName nameKey="notFound.practice" />
        </Link>
      </div>
    </div>
  );
}
