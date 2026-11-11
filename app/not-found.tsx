import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <Search size={40} />
        <span className="eyebrow">Ошибка 404</span>
        <h1>Страница не найдена</h1>
        <p>
          Возможно, ссылка устарела или в адресе есть опечатка. Вернитесь к
          списку заданий, чтобы продолжить практику.
        </p>
        <Link href="/" className="button button-primary">
          <ArrowLeft size={16} />К практикуму
        </Link>
      </div>
    </div>
  );
}
