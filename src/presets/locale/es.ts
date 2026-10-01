import type { PresetMessages } from './en';

export const spanishPresetMessages = {
  'complexity.beginner': 'principiante',
  'complexity.intermediate': 'intermedio',
  'complexity.advanced': 'avanzado',
  'blank.name': 'En blanco',
  'blank.description': 'Empieza con un lienzo vacío y crea tu propio flujo de trabajo.',
  'bounded-cta-attention.name': 'Secuencia limitada para destacar la llamada a la acción',
  'bounded-cta-attention.description':
    'Destaca dos veces el encabezado de la colección al hacer clic en la llamada a la acción principal y después muestra un aviso de finalización.',
  'bounded-cta-attention.workflow.name': 'Secuencia limitada para destacar la llamada a la acción',
  'bounded-cta-attention.workflow.nodes.attention-click.data.label':
    'Clic en la llamada a la acción de la colección',
  'bounded-cta-attention.workflow.nodes.attention-loop.data.label': 'Repetir dos veces',
  'bounded-cta-attention.workflow.nodes.attention-add.data.label': 'Destacar el destino',
  'bounded-cta-attention.workflow.nodes.attention-on.data.label': 'Mantener durante 600 ms',
  'bounded-cta-attention.workflow.nodes.attention-remove.data.label': 'Quitar el resaltado',
  'bounded-cta-attention.workflow.nodes.attention-off.data.label': 'Pausar durante 600 ms',
  'bounded-cta-attention.workflow.nodes.attention-done.data.label': 'La colección está lista',
  'bounded-cta-attention.workflow.nodes.attention-done.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">La colección cotidiana</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Explora a tu ritmo</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">El encabezado de la colección se ha destacado dos veces. Descubre de cerca cualquier objeto que te llame la atención.</p>\n</div>',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.label':
    'Configuración: CSS necesario',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.config.noteText':
    'Usa #shop-now y #collection h2, el destino del desplazamiento de la llamada a la acción de la demo. La demo incluye .dxp-cta-attention { outline: 3px solid #697856; outline-offset: 6px; }. Añade esa clase a la hoja de estilos de tu sitio web.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.label':
    'Configuración: Conexiones del bucle',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.config.noteText':
    'El bucle espera a que el cuerpo completo se ejecute dos veces (2,4 segundos en total) y después sigue la salida done una vez. Deja la espera final del cuerpo sin conectar: nunca la conectes de nuevo al bucle ni a done.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.label':
    'Configuración: Límites de finalización',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.config.noteText':
    'La finalización indica que la secuencia de clases terminó, no que el visitante interactuó. Los clics repetidos pueden iniciar ejecuciones simultáneas. Destruir el motor de ejecución a mitad del cuerpo no revierte los cambios del DOM; elimina la clase durante la limpieza de la aplicación si es necesario.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.label':
    'Resumen del preajuste',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.config.noteText':
    'Secuencia limitada para destacar la llamada a la acción\n\nDestaca dos veces el encabezado de la colección al hacer clic en la llamada a la acción principal y después muestra un aviso de finalización.',
  'bounded-cta-attention.workflow.edges.attention-loop-to-attention-add.label': 'Repetir el cuerpo',
  'bounded-cta-attention.workflow.edges.attention-loop-to-attention-done.label':
    'Tras ambas repeticiones',
  'campaign-headline.name': 'Titular de campaña',
  'campaign-headline.description':
    'Sustituye el titular principal durante la semana UTC actual, de lunes a domingo; fuera de ese periodo, lo deja sin cambios.',
  'campaign-headline.workflow.name': 'Titular de campaña',
  'campaign-headline.workflow.nodes.headline-load.data.label': 'Página cargada',
  'campaign-headline.workflow.nodes.headline-day.data.label': '¿Semana de campaña (UTC)?',
  'campaign-headline.workflow.nodes.headline-update.data.label': 'Mostrar el titular de campaña',
  'campaign-headline.workflow.nodes.headline-update.data.config.value':
    'Una nueva temporada de favoritos para el día a día.',
  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.label':
    'Configuración: Semana de campaña',
  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.config.noteText':
    'Usa la semana UTC actual (de lunes a domingo), calculada al cargar este módulo de preajuste. Recarga la aplicación para actualizarla; los flujos aplicados o exportados conservan sus fechas guardadas. Puedes editar ambas fechas.',
  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.label':
    'Configuración: Destino del titular',
  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.config.noteText':
    'Usa .hero h1. La sustitución del texto elimina su marcado anidado. La salida false termina intencionadamente sin modificar la página.',
  'campaign-headline.workflow.nodes.campaign-headline-overview.data.label': 'Resumen del preajuste',
  'campaign-headline.workflow.nodes.campaign-headline-overview.data.config.noteText':
    'Titular de campaña\n\nSustituye el titular principal durante la semana UTC actual, de lunes a domingo; fuera de ese periodo, lo deja sin cambios.',
  'campaign-headline.workflow.edges.headline-day-to-headline-update.label': 'Semana de campaña',
  'campaign-url-personalization.name': 'Personalización por URL de campaña',
  'campaign-url-personalization.description':
    'Da la bienvenida a los visitantes de la campaña everyday-edit con un texto personalizado y conserva un mensaje predeterminado.',
  'campaign-url-personalization.workflow.name': 'Personalización por URL de campaña',
  'campaign-url-personalization.workflow.nodes.campaign-load.data.label': 'Página cargada',
  'campaign-url-personalization.workflow.nodes.campaign-check.data.label':
    '¿Campaña everyday-edit?',
  'campaign-url-personalization.workflow.nodes.campaign-matched.data.label': 'Mensaje de campaña',
  'campaign-url-personalization.workflow.nodes.campaign-matched.data.config.value':
    'Te damos la bienvenida a nuestra selección cotidiana: objetos cuidados para mañanas sin prisas.',
  'campaign-url-personalization.workflow.nodes.campaign-default.data.label':
    'Mensaje predeterminado',
  'campaign-url-personalization.workflow.nodes.campaign-default.data.config.value':
    'Descubre objetos diseñados con cuidado para el día a día.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.label':
    'Configuración: Parámetro de campaña',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.config.noteText':
    'Visita /demo-site.html?utm_campaign=everyday-edit para obtener una coincidencia. Los valores de consulta son exactos y distinguen mayúsculas y minúsculas; sustituye el parámetro y el valor por los de tu campaña.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.label':
    'Configuración: Sitio web de vista previa',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.config.noteText':
    'Usa .hero .description. Configura la URL del sitio web del editor para la página que vas a probar; aplicar un preajuste conserva la URL actual del sitio web.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.label':
    'Resumen del preajuste',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.config.noteText':
    'Personalización por URL de campaña\n\nDa la bienvenida a los visitantes de la campaña everyday-edit con un texto personalizado y conserva un mensaje predeterminado.',
  'campaign-url-personalization.workflow.edges.campaign-check-to-campaign-matched.label':
    'Coincidencia de campaña',
  'campaign-url-personalization.workflow.edges.campaign-check-to-campaign-default.label':
    'Predeterminado',
  'click-to-open-help.name': 'Ayuda al hacer clic',
  'click-to-open-help.description':
    'Ofrece ayuda sobre el boletín junto al formulario cuando se hace clic en el enlace del boletín.',
  'click-to-open-help.workflow.name': 'Ayuda al hacer clic',
  'click-to-open-help.workflow.nodes.help-click.data.label': 'Clic en el enlace del boletín',
  'click-to-open-help.workflow.nodes.help-popover.data.label': 'Ayuda del boletín',
  'click-to-open-help.workflow.nodes.help-popover.data.config.content':
    '<style>[data-visual-dxp-popover="help-popover"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="help-popover"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="help-popover"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">✉️</span> Introduce tu correo electrónico y selecciona la flecha para suscribirte.</p>',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.label':
    'Configuración: Destino de la ayuda',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.config.noteText':
    'Usa #collection .section-heading a como destino del clic en la demo y #newsletter form como anclaje. El enlace de la demo se desplaza hasta el boletín; usa un enlace o botón de ayuda accesible mediante teclado en tu sitio.',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.label':
    'Configuración: Texto de ayuda',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.config.noteText':
    'Edita el texto para que coincida con las condiciones de tu boletín. Abrir la ayuda no envía ni confirma una suscripción.',
  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.label':
    'Resumen del preajuste',
  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.config.noteText':
    'Ayuda al hacer clic\n\nOfrece ayuda sobre el boletín junto al formulario cuando se hace clic en el enlace del boletín.',
  'delayed-welcome.name': 'Bienvenida con espera',
  'delayed-welcome.description':
    'Da a los visitantes dos segundos para acomodarse antes de mostrar un breve mensaje de bienvenida.',
  'delayed-welcome.workflow.name': 'Bienvenida con espera',
  'delayed-welcome.workflow.nodes.welcome-load.data.label': 'Página cargada',
  'delayed-welcome.workflow.nodes.welcome-delay.data.label': 'Esperar dos segundos',
  'delayed-welcome.workflow.nodes.welcome-popover.data.label': 'Te damos la bienvenida a Atelier',
  'delayed-welcome.workflow.nodes.welcome-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Te damos la bienvenida a Atelier</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Siéntete como en casa</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Descubre a tu ritmo objetos diseñados con cuidado para el día a día.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Explora la colección</span><span aria-hidden="true">↗</span></a>\n</div>',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.label':
    'Configuración: Contenido de bienvenida',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.config.noteText':
    'La demo contiene #collection. Actualiza el enlace y el texto de bienvenida para tu sitio web.',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.label':
    'Configuración: Frecuencia de visualización',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.config.noteText':
    'Se ejecuta una vez por carga de página; no hay control de frecuencia entre visitas.',
  'delayed-welcome.workflow.nodes.delayed-welcome-overview.data.label': 'Resumen del preajuste',
  'delayed-welcome.workflow.nodes.delayed-welcome-overview.data.config.noteText':
    'Bienvenida con espera\n\nDa a los visitantes dos segundos para acomodarse antes de mostrar un breve mensaje de bienvenida.',
  'engaged-reader-invitation.name': 'Invitación para lectores interesados',
  'engaged-reader-invitation.description':
    'Invita a los visitantes que se desplazan hasta el 70 % de la página a descubrir el boletín.',
  'engaged-reader-invitation.workflow.name': 'Invitación para lectores interesados',
  'engaged-reader-invitation.workflow.nodes.reader-scroll.data.label':
    'Desplazamiento hasta el 70 %',
  'engaged-reader-invitation.workflow.nodes.reader-popover.data.label': 'Un poco de inspiración',
  'engaged-reader-invitation.workflow.nodes.reader-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">El diario de Atelier</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">¿Te gusta la colección?</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Descubre de vez en cuando historias y nuevos objetos en nuestro boletín.</p>\n  <a href="#newsletter" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Descubre el boletín</span><span aria-hidden="true">↗</span></a>\n</div>',
  'engaged-reader-invitation.workflow.nodes.reader-cookie.data.label':
    'Registrar invitación mostrada',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-1.data.label':
    'Configuración: Desplazamiento y enlace',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-1.data.config.noteText':
    'Requiere una página con desplazamiento y que el visitante se desplace hacia abajo; #newsletter existe en la demo.',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.label':
    'Configuración: Marcador de invitación',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.config.noteText':
    'Escribe dxp_reader_invitation=shown durante 7 días inmediatamente después de mostrar la invitación. Esto registra la visualización, no la suscripción, y no bloquea futuras cargas de página.',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.label':
    'Resumen del preajuste',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.config.noteText':
    'Invitación para lectores interesados\n\nInvita a los visitantes que se desplazan hasta el 70 % de la página a descubrir el boletín.',
  'exit-intent-offer.name': 'Oferta al intentar salir con control de frecuencia',
  'exit-intent-offer.description':
    'Muestra un recordatorio de envío al intentar salir solo si no existe su marcador de sesión.',
  'exit-intent-offer.workflow.name': 'Oferta al intentar salir con control de frecuencia',
  'exit-intent-offer.workflow.nodes.exit-trigger.data.label': 'El puntero sale por arriba',
  'exit-intent-offer.workflow.nodes.exit-check.data.label': '¿Oferta ya mostrada?',
  'exit-intent-offer.workflow.nodes.exit-popover.data.label': 'Antes de irte',
  'exit-intent-offer.workflow.nodes.exit-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Un envío cuidado</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Un envío cuidado</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Envío gratuito en pedidos superiores a 75 €. Vuelve a echar un vistazo cuando quieras.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Volver a la colección</span><span aria-hidden="true">↗</span></a>\n</div>',
  'exit-intent-offer.workflow.nodes.exit-cookie.data.label': 'Recordar durante esta sesión',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.label':
    'Configuración: Condiciones de la oferta',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.config.noteText':
    'Usa la oferta de envío de la demo y el enlace #collection; comprueba las condiciones de tu propia oferta antes de usarlo.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.label':
    'Configuración: Marcador de sesión',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.config.noteText':
    'Escribe dxp_exit_offer=shown como cookie de sesión (cookieDays: 0). Una coincidencia true termina sin mostrar nada. Borra la cookie y las claves coincidentes del almacenamiento del navegador para volver a probarlo.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.label':
    'Configuración: Detección de salida',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.config.noteText':
    'La intención de salida se detecta cuando el puntero abandona el borde superior, una vez por instalación del motor de ejecución; no detecta la navegación hacia atrás en móviles.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.label': 'Resumen del preajuste',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.config.noteText':
    'Oferta al intentar salir con control de frecuencia\n\nMuestra un recordatorio de envío al intentar salir solo si no existe su marcador de sesión.',
  'exit-intent-offer.workflow.edges.exit-check-to-exit-popover.label': 'Aún no se ha mostrado',
  'frustration-recovery.name': 'Ayuda ante la frustración',
  'frustration-recovery.description':
    'Ofrece ayuda para navegar tras varios clics cercanos y registra un evento genérico de asistencia.',
  'frustration-recovery.workflow.name': 'Ayuda ante la frustración',
  'frustration-recovery.workflow.nodes.recovery-trigger.data.label': 'Tres clics cercanos',
  'frustration-recovery.workflow.nodes.recovery-check.data.label': '¿Ayuda ya mostrada?',
  'frustration-recovery.workflow.nodes.recovery-help.data.label': 'Un poco de ayuda para navegar',
  'frustration-recovery.workflow.nodes.recovery-help.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Un poco de orientación</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">¿Te cuesta encontrar lo que buscas?</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Prueba la navegación de la colección o tómate un descanso y vuelve cuando quieras.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Ver la colección</span><span aria-hidden="true">↗</span></a>\n</div>',
  'frustration-recovery.workflow.nodes.recovery-event.data.label': 'Registrar ayuda mostrada',
  'frustration-recovery.workflow.nodes.recovery-cookie.data.label': 'Recordar ayuda mostrada',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.label':
    'Configuración: Endpoint de eventos',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.config.noteText':
    'Sustituye https://events.example.invalid/dxp-events por tu propio endpoint de pruebas o de eventos antes de ejecutar. Debe aceptar POST JSON con Content-Type: application/json y devolver 2xx; configura CORS si el origen es distinto. El dominio reservado .invalid no tiene ningún servicio.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.label':
    'Configuración: Solo evento genérico',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.config.noteText':
    'El cuerpo contiene solo {"event":"assistance_shown"}. No añadas datos personales, URL de páginas, valores de formularios, credenciales ni identificadores. Esto no es una integración de analítica ni un ticket de soporte.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.label':
    'Configuración: Alcance de los clics de frustración',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.config.noteText':
    'Los clics de frustración se detectan en todo el documento, sin limitarse a un selector. Usa #collection en el texto de ayuda.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.label':
    'Configuración: Límites de frecuencia',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.config.noteText':
    'dxp_assistance_shown es una cookie de sesión escrita después del intento HTTP, incluso si falla. Registra que se mostró la ayuda, no la entrega del evento; los disparadores simultáneos antes de la respuesta pueden repetir las solicitudes. Es un control de frecuencia aproximado, no un límite atómico de solicitudes.',
  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.label':
    'Resumen del preajuste',
  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.config.noteText':
    'Ayuda ante la frustración\n\nOfrece ayuda para navegar tras varios clics cercanos y registra un evento genérico de asistencia.',
  'frustration-recovery.workflow.edges.recovery-check-to-recovery-help.label':
    'Aún no se ha mostrado',
  'inactivity-assistance.name': 'Ayuda por inactividad',
  'inactivity-assistance.description':
    'Tras 30 segundos sin actividad, ofrece orientación sobre el boletín si existe el formulario o ayuda general en caso contrario.',
  'inactivity-assistance.workflow.name': 'Ayuda por inactividad',
  'inactivity-assistance.workflow.nodes.idle-trigger.data.label': 'Inactividad durante 30 segundos',
  'inactivity-assistance.workflow.nodes.idle-check.data.label':
    '¿Existe el formulario del boletín?',
  'inactivity-assistance.workflow.nodes.idle-delay.data.label': 'Esperar un segundo más',
  'inactivity-assistance.workflow.nodes.idle-help.data.label': 'Orientación sobre el boletín',
  'inactivity-assistance.workflow.nodes.idle-help.data.config.content':
    '<style>[data-visual-dxp-popover="idle-help"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="idle-help"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="idle-help"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">✉️</span> Introduce tu correo electrónico y pulsa el botón de la flecha para suscribirte.</p>',
  'inactivity-assistance.workflow.nodes.idle-fallback.data.label': 'Ayuda general para navegar',
  'inactivity-assistance.workflow.nodes.idle-fallback.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">A tu ritmo</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Tómate tu tiempo</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Usa la navegación de la página para seguir explorando. Puedes cerrar este consejo cuando quieras.</p>\n</div>',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-1.data.label':
    'Configuración: Anclaje y alternativa',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-1.data.config.noteText':
    'Usa #newsletter form; elimínalo para probar la alternativa. La condición comprueba su existencia, no su visibilidad, validez ni interacción.',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.label':
    'Configuración: Comportamiento de los tiempos',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.config.noteText':
    'La actividad reinicia el temporizador de inactividad y puede provocar ayuda posterior. La actividad durante la espera adicional de 1 segundo no la cancela. El anclaje debe seguir existiendo después de esa espera.',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.label':
    'Resumen del preajuste',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.config.noteText':
    'Ayuda por inactividad\n\nTras 30 segundos sin actividad, ofrece orientación sobre el boletín si existe el formulario o ayuda general en caso contrario.',
  'inactivity-assistance.workflow.edges.idle-check-to-idle-delay.label': 'Formulario disponible',
  'inactivity-assistance.workflow.edges.idle-check-to-idle-fallback.label': 'Sin formulario',
  'mobile-specific-messaging.name': 'Mensajes específicos para móviles',
  'mobile-specific-messaging.description':
    'Elige un texto breve para móviles o uno más completo para ordenadores en la descripción principal.',
  'mobile-specific-messaging.workflow.name': 'Mensajes específicos para móviles',
  'mobile-specific-messaging.workflow.nodes.device-load.data.label': 'Página cargada',
  'mobile-specific-messaging.workflow.nodes.device-check.data.label': '¿Dispositivo móvil?',
  'mobile-specific-messaging.workflow.nodes.device-mobile.data.label': 'Mensaje para móviles',
  'mobile-specific-messaging.workflow.nodes.device-mobile.data.config.value':
    'Favoritos para el día a día, listos para descubrir estés donde estés.',
  'mobile-specific-messaging.workflow.nodes.device-desktop.data.label': 'Mensaje para ordenadores',
  'mobile-specific-messaging.workflow.nodes.device-desktop.data.config.value':
    'Descubre de cerca los materiales naturales y los detalles cuidados de nuestra colección cotidiana.',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-setup-1.data.label':
    'Configuración: Detección de dispositivo',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-setup-1.data.config.noteText':
    'Usa .hero .description. La detección utiliza indicaciones del navegador sobre el dispositivo o el agente de usuario, no el ancho de la ventana; cambiar el tamaño de la vista previa no emula un móvil.',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.label':
    'Resumen del preajuste',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.config.noteText':
    'Mensajes específicos para móviles\n\nElige un texto breve para móviles o uno más completo para ordenadores en la descripción principal.',
  'mobile-specific-messaging.workflow.edges.device-check-to-device-mobile.label': 'Móvil',
  'mobile-specific-messaging.workflow.edges.device-check-to-device-desktop.label': 'Ordenador',
  'returning-visitor-experience.name': 'Experiencia para visitantes recurrentes',
  'returning-visitor-experience.description':
    'Saluda a quienes regresan o da la bienvenida a los nuevos visitantes y recuerda que se mostró la bienvenida.',
  'returning-visitor-experience.workflow.name': 'Experiencia para visitantes recurrentes',
  'returning-visitor-experience.workflow.nodes.visitor-load.data.label': 'Página cargada',
  'returning-visitor-experience.workflow.nodes.visitor-check.data.label':
    '¿Bienvenida mostrada antes?',
  'returning-visitor-experience.workflow.nodes.visitor-returning.data.label':
    'Mensaje de bienvenida al regresar',
  'returning-visitor-experience.workflow.nodes.visitor-returning.data.config.value':
    'Te damos la bienvenida de nuevo. Descubre algo especial para tu día a día.',
  'returning-visitor-experience.workflow.nodes.visitor-welcome.data.label':
    'Bienvenida en la primera visita',
  'returning-visitor-experience.workflow.nodes.visitor-welcome.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Hecho con cuidado</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Te damos la bienvenida a Atelier</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Empieza por la colección cotidiana y descubre objetos hechos para durar.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Descubre la colección</span><span aria-hidden="true">↗</span></a>\n</div>',
  'returning-visitor-experience.workflow.nodes.visitor-cookie.data.label':
    'Recordar bienvenida mostrada',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-1.data.label':
    'Configuración: Bienvenida y marcador',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-1.data.config.noteText':
    'Usa .hero .description y #collection. dxp_visitor_welcome=shown dura 30 días y registra una bienvenida mostrada, no la identidad ni el historial de compras.',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-2.data.label':
    'Configuración: Repetir la primera visita',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-2.data.config.noteText':
    'Borra la cookie y la clave coincidente del almacenamiento local o de sesión para volver a probar la rama de primera visita.',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-overview.data.label':
    'Resumen del preajuste',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-overview.data.config.noteText':
    'Experiencia para visitantes recurrentes\n\nSaluda a quienes regresan o da la bienvenida a los nuevos visitantes y recuerda que se mostró la bienvenida.',
  'returning-visitor-experience.workflow.edges.visitor-check-to-visitor-returning.label':
    'Visitante recurrente',
  'returning-visitor-experience.workflow.edges.visitor-check-to-visitor-welcome.label':
    'Primera bienvenida',
  'segmented-onboarding.name': 'Recorrido de bienvenida segmentado',
  'segmented-onboarding.description':
    'Reconoce las visitas anteriores; para los nuevos visitantes, adapta la orientación según la campaña y registra la entrega de la orientación.',
  'segmented-onboarding.workflow.name': 'Recorrido de bienvenida segmentado',
  'segmented-onboarding.workflow.nodes.onboarding-entry.data.label': '1 · Reconocer la visita',
  'segmented-onboarding.workflow.nodes.onboarding-guidance.data.label':
    '2 · Orientación contextual',
  'segmented-onboarding.workflow.nodes.onboarding-record.data.label': '3 · Registrar la entrega',
  'segmented-onboarding.workflow.nodes.onboarding-load.data.label': 'Página cargada',
  'segmented-onboarding.workflow.nodes.onboarding-seen.data.label': '¿Orientación entregada antes?',
  'segmented-onboarding.workflow.nodes.onboarding-return.data.label':
    'Te damos la bienvenida de nuevo',
  'segmented-onboarding.workflow.nodes.onboarding-return.data.config.value':
    'Te damos la bienvenida de nuevo. Tu colección está lista para descubrirla.',
  'segmented-onboarding.workflow.nodes.onboarding-entry-note.data.label':
    'Configuración: Marcos y nuevas pruebas',
  'segmented-onboarding.workflow.nodes.onboarding-entry-note.data.config.noteText':
    'Los marcos agrupan las etapas de reconocimiento, orientación y entrega. Las notas son anotaciones desconectadas. Las coincidencias de cookies o almacenamiento pueden clasificar al visitante como recurrente; borra todas las claves coincidentes para volver a probarlo.',
  'segmented-onboarding.workflow.nodes.onboarding-campaign.data.label': '¿Campaña de bienvenida?',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-copy.data.label':
    'Mensaje de bienvenida inicial',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-copy.data.config.value':
    'Te damos la bienvenida. Empieza por la colección y conoce Atelier.',
  'segmented-onboarding.workflow.nodes.onboarding-default-copy.data.label':
    'Mensaje de descubrimiento',
  'segmented-onboarding.workflow.nodes.onboarding-default-copy.data.config.value':
    'Te damos la bienvenida. Descubre materiales naturales y detalles cuidados.',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-delay.data.label':
    'Esperar 1,5 segundos',
  'segmented-onboarding.workflow.nodes.onboarding-default-delay.data.label': 'Esperar 2 segundos',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-help.data.label':
    'Descubre tu recorrido de bienvenida',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-help.data.config.content':
    '<style>[data-visual-dxp-popover="onboarding-campaign-help"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="onboarding-campaign-help"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="onboarding-campaign-help"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">🌿</span> Empieza aquí para descubrir la colección.</p>',
  'segmented-onboarding.workflow.nodes.onboarding-default-help.data.label':
    'Empieza por la colección',
  'segmented-onboarding.workflow.nodes.onboarding-default-help.data.config.content':
    '<style>[data-visual-dxp-popover="onboarding-default-help"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="onboarding-default-help"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="onboarding-default-help"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">🌿</span> Explora todos los objetos de la colección.</p>',
  'segmented-onboarding.workflow.nodes.onboarding-guidance-note.data.label':
    'Configuración: Destinos de la orientación',
  'segmented-onboarding.workflow.nodes.onboarding-guidance-note.data.config.noteText':
    'Usa .hero .description, #shop-now y #collection. Prueba con y sin ?utm_campaign=onboarding. Los anclajes de la orientación deben existir al terminar las esperas.',
  'segmented-onboarding.workflow.nodes.onboarding-event.data.label':
    'Registrar orientación mostrada',
  'segmented-onboarding.workflow.nodes.onboarding-cookie.data.label': 'Marcar entrega completada',
  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.label':
    'Configuración: Endpoint de eventos',
  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.config.noteText':
    'Sustituye https://events.example.invalid/dxp-events por tu propio endpoint de pruebas o de eventos antes de ejecutar. Debe aceptar POST JSON con Content-Type: application/json y devolver 2xx; configura CORS si el origen es distinto. El dominio reservado .invalid no tiene ningún servicio.',
  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.label':
    'Configuración: Marcador de entrega',
  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.config.noteText':
    'dxp_onboarding_delivered=yes dura 30 días. True omite la orientación y HTTP; false elige una rama de campaña. El cuerpo genérico del POST es {"event":"onboarding_guidance_displayed"}.',
  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.label':
    'Configuración: Significado de finalización',
  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.config.noteText':
    'La finalización indica que se actualizó el texto del DOM, se mostró la orientación y se intentó la solicitud HTTP. No detecta lecturas, cierres, clics en enlaces, suscripciones, compras ni persistencia en el servidor. Un fallo HTTP también escribe la cookie de finalización; no confirma la entrega del evento.',
  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.label':
    'Resumen del preajuste',
  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.config.noteText':
    'Recorrido de bienvenida segmentado\n\nReconoce las visitas anteriores; para los nuevos visitantes, adapta la orientación según la campaña y registra la entrega de la orientación.',
  'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-return.label':
    'Visitante recurrente',
  'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-campaign.label':
    'Primera orientación',
  'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-campaign-copy.label':
    'Bienvenida inicial',
  'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-default-copy.label':
    'Otros visitantes',
} satisfies PresetMessages;
