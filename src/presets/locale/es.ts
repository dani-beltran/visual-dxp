import type { PresetMessages } from './en';

export const spanishPresetMessages = {
  'complexity.beginner': 'principiante',
  'complexity.intermediate': 'intermedio',
  'complexity.advanced': 'avanzado',
  'contextual-support.name': 'Ayuda contextual según el horario de atención',
  'contextual-support.description':
    'Pasa el cursor sobre Ayuda para mostrar el chat de soporte de la demo durante el horario de atención o un mensaje fuera de horario.',
  'contextual-support.workflow.name': 'Ayuda contextual según el horario de atención',
  'contextual-support.workflow.nodes.support-hover.data.label': 'Pasar el cursor sobre Ayuda',
  'contextual-support.workflow.nodes.support-hours.data.label': 'Horario de atención (UTC)',
  'contextual-support.workflow.nodes.support-online.data.label': 'Centro de ayuda',
  'contextual-support.workflow.nodes.support-offline.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere"><div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;letter-spacing:-1px">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px">®</span></span></div><p style="margin:22px 0 12px;font-size:10px;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Estamos para ayudarte</p><h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15">Volvemos pronto</h2><p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Nuestro horario de atención es de 09:00 a 17:00 UTC todos los días. Vuelve a visitarnos durante ese horario. Mientras tanto, descubre la colección a tu ritmo.</p><a href="#collection" style="display:inline-block;margin-top:22px;padding:12px 20px;background:#697856;color:#fff;border-radius:6px;text-decoration:none;font-size:13px">Descubrir la colección ↗</a></div>',
  'contextual-support.workflow.nodes.support-offline.data.label': 'Fuera del horario de atención',
  'contextual-support.workflow.nodes.support-trigger-note.data.config.noteText':
    'Elige el enlace de ayuda que inicia este recorrido. En la demo, pasa el cursor sobre Ayuda al pie de la página para mostrar el chat durante el horario de atención o un mensaje fuera de horario. El enlace sigue funcionando al hacer clic.',
  'contextual-support.workflow.nodes.support-trigger-note.data.label':
    'Configuración: Enlace de ayuda',
  'contextual-support.workflow.nodes.support-hours-note.data.config.noteText':
    'La demo ofrece chat todos los días de 09:00 a 17:00 UTC, una hora de referencia mundial. El último minuto elegido está incluido: 16:59 significa que cierra a las 17:00. Cambia el horario, la zona horaria y el mensaje de ausencia a la vez. La hora local es la del visitante. No se comprueban festivos, días laborables ni disponibilidad del equipo.',
  'contextual-support.workflow.nodes.support-hours-note.data.label':
    'Configuración: Horario de atención',
  'contextual-support.workflow.nodes.support-embed-note.data.config.noteText':
    'La demo muestra un icono de chat. Haz clic para abrir una conversación de ejemplo; ningún agente recibe estos mensajes. Pide al equipo de tu web que conecte tu herramienta de chat. Actualiza el mensaje de ausencia y su enlace a la colección.',
  'contextual-support.workflow.nodes.support-embed-note.data.label': 'Configuración: Chat de ayuda',
  'contextual-support.workflow.nodes.contextual-support-overview.data.config.noteText':
    'Pasa el cursor sobre Ayuda para mostrar el chat de soporte de la demo durante el horario de atención o un mensaje fuera de horario.',
  'contextual-support.workflow.nodes.contextual-support-overview.data.label':
    'Resumen de la plantilla',
  'contextual-support.workflow.edges.support-hours-to-support-online.label': 'Abierto',
  'contextual-support.workflow.edges.support-hours-to-support-offline.label': 'Cerrado',
  'welcome-journey.name': 'Recorrido de bienvenida',
  'welcome-journey.description':
    'Espera un momento al abrir la página y muestra una oferta de bienvenida si está el botón de compra. Si no, cambia el título del boletín.',
  'welcome-journey.welcome': 'Página visitada',
  'welcome-journey.pause': 'Espera un momento',
  'welcome-journey.check': 'Encuentra el momento adecuado',
  'welcome-journey.offer': 'Un pequeño regalo de bienvenida',
  'welcome-journey.update': 'Dale un toque personal',
  'welcome-journey.value': 'Un poco de inspiración, solo para ti.',
  'welcome-journey.true': 'Elemento encontrado',
  'welcome-journey.false': 'En caso contrario',
  'welcome-journey.overview': 'Resumen de la plantilla',
  'welcome-journey.setup': 'Configuración: Bienvenida y contenido de la página',
  'welcome-journey.instructions':
    'Elige el botón de compra y el título del boletín de tu web. Actualiza la oferta de bienvenida, el código de descuento y el enlace a la colección antes de publicar. El recorrido empieza 1,5 segundos después de cada apertura o recarga de la página.',
  'welcome-journey.content':
    '<div style="padding:28px;font-family:system-ui;color:#203a30"><span style="font-size:11px;letter-spacing:2px;color:#277457">UN PEQUEÑO DETALLE PARA TI</span><h2 style="font-size:29px;line-height:1.15;font-weight:500;margin:14px 0">Lo bueno empieza aquí.</h2><p style="color:#6b7770;line-height:1.6">Te damos la bienvenida a Atelier. Disfruta de un 15% de descuento en tu primer pedido con el código <strong>HELLO15</strong>.</p><a href="#collection" style="display:inline-block;background:#267456;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:8px">Encuentra tu favorito para cada día ↗</a></div>',
  'blank.name': 'En blanco',
  'blank.description': 'Empieza con un lienzo vacío y crea tu propio flujo de trabajo.',
  'bounded-cta-attention.name': 'Secuencia limitada para destacar la llamada a la acción',
  'bounded-cta-attention.description':
    'Cuando alguien hace clic en el botón principal de compra, resalta dos veces el título de la colección y muestra un consejo final.',
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
    'Configuración: Aspecto del resaltado',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.config.noteText':
    'La demo resalta el título de la colección al hacer clic en Comprar ahora. Elige el botón y el título para tu web. Pide a tu equipo que añada el mismo efecto de contorno; necesita un estilo llamado dxp-cta-attention.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.label':
    'Configuración: Repetir el resaltado',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.config.noteText':
    'El resaltado se repite dos veces, dura 2,4 segundos en total y después muestra el consejo final. Deja el último paso de espera de la secuencia sin una conexión de salida. El paso de repetición ya controla cuándo repetir y cuándo terminar.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.label':
    'Configuración: Cuándo termina el resaltado',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.config.noteText':
    'Terminar solo significa que acabó la secuencia, no que el visitante la haya visto. Otro clic puede iniciar una nueva secuencia antes de que termine la primera. Si detienes el recorrido antes de tiempo, el resaltado puede seguir visible; pide al equipo de tu web que lo quite si hace falta.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.label':
    'Resumen del preajuste',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.config.noteText':
    'Cuando alguien hace clic en el botón principal de compra, resalta dos veces el título de la colección y muestra un consejo final.',
  'bounded-cta-attention.workflow.edges.attention-loop-to-attention-add.label': 'Repetir el cuerpo',
  'bounded-cta-attention.workflow.edges.attention-loop-to-attention-done.label':
    'Tras ambas repeticiones',
  'campaign-headline.name': 'Titular de campaña',
  'campaign-headline.description':
    'Muestra un título de campaña durante las fechas elegidas. Fuera de esas fechas, conserva el título habitual.',
  'campaign-headline.workflow.name': 'Titular de campaña',
  'campaign-headline.workflow.nodes.headline-load.data.label': 'Página cargada',
  'campaign-headline.workflow.nodes.headline-day.data.label': '¿Semana de campaña (UTC)?',
  'campaign-headline.workflow.nodes.headline-update.data.label': 'Mostrar el titular de campaña',
  'campaign-headline.workflow.nodes.headline-update.data.config.value':
    'Una nueva temporada de favoritos para el día a día.',
  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.label':
    'Configuración: Fechas de la campaña',
  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.config.noteText':
    'Elige el primer y último día de tu campaña. Las fechas sugeridas abarcan de lunes a domingo de la semana actual en UTC, una hora de referencia mundial. Recarga la aplicación para renovar las sugerencias. Los recorridos ya añadidos o descargados conservan sus fechas guardadas.',
  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.label':
    'Configuración: Título de la página',
  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.config.noteText':
    'Elige el título principal que quieres cambiar y escribe el mensaje de campaña. Al sustituirlo se puede perder el formato especial dentro del título. Fuera de las fechas de campaña, la página queda como está.',
  'campaign-headline.workflow.nodes.campaign-headline-overview.data.label': 'Resumen del preajuste',
  'campaign-headline.workflow.nodes.campaign-headline-overview.data.config.noteText':
    'Muestra un título de campaña durante las fechas elegidas. Fuera de esas fechas, conserva el título habitual.',
  'campaign-headline.workflow.edges.headline-day-to-headline-update.label': 'Semana de campaña',
  'campaign-url-personalization.name': 'Personalización por URL de campaña',
  'campaign-url-personalization.description':
    'Muestra una bienvenida especial a quienes llegan por el enlace de la campaña de verano y un mensaje habitual al resto.',
  'campaign-url-personalization.workflow.name': 'Personalización por URL de campaña',
  'campaign-url-personalization.workflow.nodes.campaign-load.data.label': 'Página cargada',
  'campaign-url-personalization.workflow.nodes.campaign-check.data.label': '¿Campaña Summer Sale?',
  'campaign-url-personalization.workflow.nodes.campaign-matched.data.label': 'Mensaje de campaña',
  'campaign-url-personalization.workflow.nodes.campaign-matched.data.config.value':
    'Te damos la bienvenida a Summer Sale: objetos cuidados para mañanas sin prisas.',
  'campaign-url-personalization.workflow.nodes.campaign-default.data.label':
    'Mensaje predeterminado',
  'campaign-url-personalization.workflow.nodes.campaign-default.data.config.value':
    'Descubre objetos diseñados con cuidado para el día a día.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.label':
    'Configuración: Enlace de campaña',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.config.noteText':
    'Para probar la demo, añade ?utm_campaign=summer-sale al final de la dirección de la página. Esta parte del enlace identifica la campaña. Cambia el nombre y el valor para que coincidan con tus enlaces, respetando mayúsculas y minúsculas.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.label':
    'Configuración: Página de vista previa',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.config.noteText':
    'Este recorrido cambia la introducción bajo el título principal. Elige el texto que quieres cambiar en tu web y la dirección de la página para la vista previa. Al añadir esta plantilla se mantiene la dirección que ya habías elegido.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.label':
    'Resumen del preajuste',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.config.noteText':
    'Muestra una bienvenida especial a quienes llegan por el enlace de la campaña de verano y un mensaje habitual al resto.',
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
    'Configuración: Enlace de ayuda y formulario',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.config.noteText':
    'En la demo, el enlace al boletín de la colección lleva al formulario de suscripción y abre ayuda a su lado. Elige tu enlace y formulario. Asegúrate de que el enlace o botón de ayuda también se pueda usar con teclado.',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.label':
    'Configuración: Mensaje de ayuda',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.config.noteText':
    'Edita el mensaje para explicar tu boletín y sus condiciones. Abrir esta ayuda no suscribe a nadie ni confirma una suscripción.',
  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.label':
    'Resumen del preajuste',
  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.config.noteText':
    'Ofrece ayuda sobre el boletín junto al formulario cuando se hace clic en el enlace del boletín.',
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
    'Configuración: Mensaje de bienvenida',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.config.noteText':
    'Actualiza el mensaje de bienvenida y elige adónde lleva su enlace. En la demo, lleva a la sección de la colección.',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.label':
    'Configuración: Cuándo se muestra',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.config.noteText':
    'La bienvenida aparece cada vez que alguien abre o recarga la página. También puede aparecer en visitas posteriores.',
  'delayed-welcome.workflow.nodes.delayed-welcome-overview.data.label': 'Resumen del preajuste',
  'delayed-welcome.workflow.nodes.delayed-welcome-overview.data.config.noteText':
    'Da a los visitantes dos segundos para acomodarse antes de mostrar un breve mensaje de bienvenida.',
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
    'Configuración: Desplazamiento y destino',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-1.data.config.noteText':
    'Prueba en una página lo bastante larga para desplazarte hacia abajo. La invitación aparece al recorrer el 70 % de la distancia disponible. Elige adónde lleva el enlace; la demo usa la sección del boletín.',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.label':
    'Configuración: Recordar la invitación',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.config.noteText':
    'El navegador recuerda durante 7 días que se mostró la invitación. Esto no significa que el visitante se haya suscrito ni impide mostrarla al abrir de nuevo la página.',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.label':
    'Resumen del preajuste',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.config.noteText':
    'Invita a los visitantes que se desplazan hasta el 70 % de la página a descubrir el boletín.',
  'exit-intent-offer.name': 'Oferta al intentar salir con control de frecuencia',
  'exit-intent-offer.description':
    'Muestra un recordatorio de envío cuando el cursor sale por la parte superior de la página, salvo que ya se haya mostrado durante esta sesión.',
  'exit-intent-offer.workflow.name': 'Oferta al intentar salir con control de frecuencia',
  'exit-intent-offer.workflow.nodes.exit-trigger.data.label': 'El puntero sale por arriba',
  'exit-intent-offer.workflow.nodes.exit-check.data.label': '¿Oferta ya mostrada?',
  'exit-intent-offer.workflow.nodes.exit-popover.data.label': 'Antes de irte',
  'exit-intent-offer.workflow.nodes.exit-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Un envío cuidado</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Un envío cuidado</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Envío gratuito en pedidos superiores a 75 €. Vuelve a echar un vistazo cuando quieras.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Volver a la colección</span><span aria-hidden="true">↗</span></a>\n</div>',
  'exit-intent-offer.workflow.nodes.exit-cookie.data.label': 'Recordar durante esta sesión',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.label':
    'Configuración: Detalles de la oferta',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.config.noteText':
    'Sustituye la oferta de envío de ejemplo por la tuya y revisa sus condiciones. Elige adónde lleva el enlace; en la demo, lleva a la colección.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.label':
    'Configuración: Mostrar la oferta una vez',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.config.noteText':
    'El navegador recuerda que ya mostró la oferta durante la sesión de navegación actual y no la repite. Para probarla de nuevo, borra los datos guardados de esta web en los ajustes del navegador.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.label':
    'Configuración: Cuándo alguien podría salir',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.config.noteText':
    'El recorrido empieza cuando el cursor sale por el borde superior de la página. Puede empezar una vez cada vez que se carga el recorrido. No detecta el uso del botón Atrás en un teléfono.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.label': 'Resumen del preajuste',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.config.noteText':
    'Muestra un recordatorio de envío cuando el cursor sale por la parte superior de la página, salvo que ya se haya mostrado durante esta sesión.',
  'exit-intent-offer.workflow.edges.exit-check-to-exit-popover.label': 'Aún no se ha mostrado',
  'frustration-recovery.name': 'Ayuda ante la frustración',
  'frustration-recovery.description':
    'Ofrece ayuda cuando alguien hace clic repetidamente o se desplaza arriba y abajo con rapidez, y registra que se mostró la ayuda.',
  'frustration-recovery.workflow.name': 'Ayuda ante la frustración',
  'frustration-recovery.workflow.nodes.recovery-trigger.data.label': 'Tres clics cercanos',
  'frustration-recovery.workflow.nodes.recovery-scroll-trigger.data.label':
    'Desplazamiento errático',
  'frustration-recovery.workflow.nodes.recovery-check.data.label': '¿Ayuda ya mostrada?',
  'frustration-recovery.workflow.nodes.recovery-help.data.label': 'Un poco de ayuda para navegar',
  'frustration-recovery.workflow.nodes.recovery-help.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Un poco de orientación</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">¿Te cuesta encontrar lo que buscas?</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Prueba la navegación de la colección o tómate un descanso y vuelve cuando quieras.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Ver la colección</span><span aria-hidden="true">↗</span></a>\n</div>',
  'frustration-recovery.workflow.nodes.recovery-event.data.label': 'Registrar ayuda mostrada',
  'frustration-recovery.workflow.nodes.recovery-cookie.data.label': 'Recordar ayuda mostrada',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.label':
    'Configuración: Dónde registrar la ayuda',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.config.noteText':
    'Este recorrido envía un mensaje para registrar que se mostró la ayuda. La dirección de ejemplo no funciona. Antes de usarlo, pide al equipo de tu web que la sustituya por una dirección válida y compruebe que la web puede enviarle mensajes.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.label':
    'Configuración: Qué se registra',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.config.noteText':
    'El mensaje solo indica que se mostró la ayuda. No incluyas datos personales, direcciones de páginas, respuestas de formularios, contraseñas ni identificadores de visitantes. No contacta con un agente ni crea una solicitud de soporte.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.label':
    'Configuración: Cuándo aparece la ayuda',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.config.noteText':
    'La ayuda puede empezar de dos formas: tres clics cercanos en 1 segundo o cuatro cambios de dirección al desplazarse en 2 segundos. Cada cambio necesita al menos 50 píxeles de movimiento; los movimientos muy pequeños no cuentan. Ambos observan toda la página. Adapta el mensaje y su enlace a la colección para tu web.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.label':
    'Configuración: Evitar repetir la ayuda',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.config.noteText':
    'Después de intentar enviar el registro, el navegador recuerda que mostró la ayuda durante esta sesión, aunque el envío falle. Hasta que termine ese intento, más clics o desplazamientos pueden volver a mostrar la ayuda y enviar otro registro.',
  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.label':
    'Resumen del preajuste',
  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.config.noteText':
    'Ofrece ayuda cuando alguien hace clic repetidamente o se desplaza arriba y abajo con rapidez, y registra que se mostró la ayuda.',
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
    'Configuración: Dónde aparece la ayuda',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-1.data.config.noteText':
    'Elige el formulario del boletín junto al que aparecerá la ayuda. Si no está, se muestra un mensaje general. Solo se comprueba si el formulario está en la página, no si es visible, está bien rellenado o se está usando.',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.label':
    'Configuración: Cuándo aparece la ayuda',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.config.noteText':
    'La actividad del visitante reinicia la espera de 30 segundos, así que la ayuda puede repetirse tras otro periodo sin actividad. Si se encuentra el formulario, se espera un segundo más. La actividad durante ese segundo no cancela el mensaje y el formulario debe seguir en la página.',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.label':
    'Resumen del preajuste',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.config.noteText':
    'Tras 30 segundos sin actividad, ofrece orientación sobre el boletín si existe el formulario o ayuda general en caso contrario.',
  'inactivity-assistance.workflow.edges.idle-check-to-idle-delay.label': 'Formulario disponible',
  'inactivity-assistance.workflow.edges.idle-check-to-idle-fallback.label': 'Sin formulario',
  'mobile-specific-messaging.name': 'Mensajes específicos para móviles',
  'mobile-specific-messaging.description':
    'Muestra una introducción más breve en teléfonos y otra más detallada en ordenadores.',
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
    'Configuración: Teléfono u ordenador',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-setup-1.data.config.noteText':
    'Elige la introducción bajo el título principal y escribe una versión para teléfonos y otra para ordenadores. El recorrido usa la información del dispositivo que facilita el navegador. Estrechar la vista previa no la convierte en un teléfono; prueba también en uno.',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.label':
    'Resumen del preajuste',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.config.noteText':
    'Muestra una introducción más breve en teléfonos y otra más detallada en ordenadores.',
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
    'Configuración: Recordar una bienvenida',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-1.data.config.noteText':
    'Elige la introducción de la página y el destino del enlace de bienvenida. El navegador recuerda durante 30 días que se mostró la bienvenida. Esto no identifica a la persona ni indica qué compró.',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-2.data.label':
    'Configuración: Probar una primera visita',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-2.data.config.noteText':
    'Para volver a ver la bienvenida de la primera visita, borra los datos guardados de esta web en los ajustes del navegador. Así eliminas el recordatorio de que ya se mostró la bienvenida.',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-overview.data.label':
    'Resumen del preajuste',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-overview.data.config.noteText':
    'Saluda a quienes regresan o da la bienvenida a los nuevos visitantes y recuerda que se mostró la bienvenida.',
  'returning-visitor-experience.workflow.edges.visitor-check-to-visitor-returning.label':
    'Visitante recurrente',
  'returning-visitor-experience.workflow.edges.visitor-check-to-visitor-welcome.label':
    'Primera bienvenida',
  'segmented-onboarding.name': 'Recorrido de bienvenida segmentado',
  'segmented-onboarding.description':
    'Da la bienvenida a los nuevos visitantes con ayuda según su enlace de campaña y recuerda que se mostró para no repetirla en visitas posteriores.',
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
    'Configuración: Entender el recorrido',
  'segmented-onboarding.workflow.nodes.onboarding-entry-note.data.config.noteText':
    'Los recuadros agrupan las etapas: reconocer al visitante, mostrar la ayuda y registrarla. Estas notas explican los pasos y no realizan acciones. Para probar de nuevo como visitante nuevo, borra los datos guardados de esta web en los ajustes del navegador.',
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
    'Configuración: Elegir el contenido de la página',
  'segmented-onboarding.workflow.nodes.onboarding-guidance-note.data.config.noteText':
    'Elige la introducción, el botón de compra y la sección de la colección de tu web. Prueba la página con y sin ?utm_campaign=onboarding al final de su dirección para ver ambas bienvenidas. El botón y la sección deben seguir en la página cuando termine cada espera.',
  'segmented-onboarding.workflow.nodes.onboarding-event.data.label':
    'Registrar orientación mostrada',
  'segmented-onboarding.workflow.nodes.onboarding-cookie.data.label': 'Marcar entrega completada',
  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.label':
    'Configuración: Dónde registrar la ayuda',
  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.config.noteText':
    'Este recorrido envía un mensaje para registrar que se mostró la ayuda. La dirección de ejemplo no funciona. Antes de usarlo, pide al equipo de tu web que la sustituya por una dirección válida y compruebe que la web puede enviarle mensajes.',
  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.label':
    'Configuración: Recordar la ayuda mostrada',
  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.config.noteText':
    'El navegador recuerda durante 30 días que se mostró la ayuda. Durante ese tiempo, el recorrido omite la ayuda y no envía otro registro. Si no hay recordatorio, elige una bienvenida según el enlace de campaña y envía un mensaje indicando que se mostró la ayuda.',
  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.label':
    'Configuración: Qué significa terminado',
  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.config.noteText':
    'Terminado significa que cambió el texto, apareció la ayuda y se intentó enviar un registro. No significa que el visitante lo leyera, hiciera clic, se suscribiera o comprara. El navegador recuerda que terminó aunque el servicio no haya recibido o guardado el registro.',
  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.label':
    'Resumen del preajuste',
  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.config.noteText':
    'Da la bienvenida a los nuevos visitantes con ayuda según su enlace de campaña y recuerda que se mostró para no repetirla en visitas posteriores.',
  'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-return.label':
    'Visitante recurrente',
  'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-campaign.label':
    'Primera orientación',
  'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-campaign-copy.label':
    'Bienvenida inicial',
  'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-default-copy.label':
    'Otros visitantes',
} satisfies PresetMessages;
