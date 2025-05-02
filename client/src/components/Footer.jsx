import { Mail, Facebook, Instagram, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-10 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Columna 1 */}
        <div>
          <h4 className="text-lg font-semibold mb-2">Contáctanos</h4>
          <p>vidanuevaimp@gmail.com</p>
          <p>Calle cinco #109 Cerro Cordillera, Valparaíso, Chile</p>
        </div>

        {/* Columna 2 */}
        <div>
          <h4 className="text-lg font-semibold mb-2">Redes Sociales</h4>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 transition hover:text-blue-400 hover:scale-105">
              <Facebook className="w-5 h-5" />
              <a
                href="https://www.facebook.com/imptvn"
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
            </li>
            <li className="flex items-center gap-2 transition hover:text-pink-400 hover:scale-105">
              <Instagram className="w-5 h-5" />
              <a
                href="https://www.instagram.com/vidanuevaimp/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            </li>
            <li className="flex items-center gap-2 transition hover:text-red-500 hover:scale-105">
              <Youtube className="w-5 h-5" />
              <a
                href="https://www.youtube.com/@iglesiamisionpentecosteste2582"
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTube
              </a>
            </li>
          </ul>
        </div>

        {/* Columna 3 */}
        <div>
          <h4 className="text-lg font-semibold mb-2">Escríbenos</h4>
          <a
            href="mailto:vidanuevaimp@gmail.com"
            className="flex items-center gap-2 transition hover:text-green-400 hover:scale-105"
          >
            <Mail className="w-5 h-5" /> vidanuevaimp@gmail.com
          </a>
        </div>
      </div>

      <div className="text-center text-sm mt-8 text-gray-400">
        © {new Date().getFullYear()} Templo Vida Nueva. Todos los derechos reservados.
      </div>
    </footer>
  );
}
