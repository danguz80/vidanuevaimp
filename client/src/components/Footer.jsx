import { Mail, Facebook, Instagram, Youtube, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-br from-violet-950 via-purple-950 to-indigo-950 text-white relative">
      {/* Línea decorativa superior */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Columna 1 */}
        <div>
          <h4 className="text-lg font-bold mb-4 text-amber-400 tracking-wide uppercase text-sm">Contacto</h4>
          <div className="flex items-start gap-2 text-violet-200 text-sm leading-relaxed">
            <MapPin className="w-4 h-4 mt-0.5 text-violet-400 shrink-0" />
            <span>Calle cinco #109 Cerro Cordillera,<br />Valparaíso, Chile</span>
          </div>
          <div className="flex items-center gap-2 mt-3 text-violet-200 text-sm">
            <Mail className="w-4 h-4 text-violet-400 shrink-0" />
            <span>vidanuevaimp@gmail.com</span>
          </div>
        </div>

        {/* Columna 2 */}
        <div>
          <h4 className="text-lg font-bold mb-4 text-amber-400 tracking-wide uppercase text-sm">Síguenos</h4>
          <ul className="space-y-3">
            <li>
              <a href="https://www.facebook.com/imptvn" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-violet-200 hover:text-blue-400 transition-colors duration-200 group text-sm">
                <span className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/40 transition-colors">
                  <Facebook className="w-4 h-4" />
                </span>
                Facebook
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/vidanuevaimp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-violet-200 hover:text-pink-400 transition-colors duration-200 group text-sm">
                <span className="w-8 h-8 rounded-full bg-pink-600/20 flex items-center justify-center group-hover:bg-pink-600/40 transition-colors">
                  <Instagram className="w-4 h-4" />
                </span>
                Instagram
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/@iglesiamisionpentecosteste2582" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 text-violet-200 hover:text-red-400 transition-colors duration-200 group text-sm">
                <span className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center group-hover:bg-red-600/40 transition-colors">
                  <Youtube className="w-4 h-4" />
                </span>
                YouTube
              </a>
            </li>
          </ul>
        </div>

        {/* Columna 3 */}
        <div>
          <h4 className="text-lg font-bold mb-4 text-amber-400 tracking-wide uppercase text-sm">Escríbenos</h4>
          <p className="text-violet-300 text-sm leading-relaxed mb-4">
            ¿Tienes alguna consulta, petición de oración o quieres conocer más de nuestra iglesia?
          </p>
          <a href="mailto:vidanuevaimp@gmail.com"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-amber-500/30 transition-all duration-200">
            <Mail className="w-4 h-4" />
            Enviar mensaje
          </a>
        </div>
      </div>

      <div className="border-t border-violet-800/40 text-center text-xs py-5 text-violet-400">
        © {new Date().getFullYear()} Templo Vida Nueva · Todos los derechos reservados
      </div>
    </footer>
  );
}
