export const tutorialSpanish = {
  'tutorial.website.custom': ({ url }: { url: string }) =>
    `Los flujos añaden experiencias a un sitio web de destino. Abre el control del sitio y guarda el destino de práctica: ${url}. Tu anfitrión proporciona este sitio y su puente de vista previa.`,
  'tutorial.restoreContent':
    'El HTML predeterminado ha cambiado. Usa Deshacer para recuperarlo, o elimina esta Ventana emergente y añade una nueva desde la biblioteca.',
  'tutorial.selectSource': 'Seleccionar nodo de origen',
  'tutorial.chooseSource': 'Elige un nodo de origen',
  'tutorial.untitled': 'Flujo sin título',
  'tutorial.entry': 'Iniciar tutorial interactivo',
  'tutorial.progress': ({ current, total }: { current: number; total: number }) =>
    `Paso ${current} de ${total}`,
  'tutorial.back': 'Atrás',
  'tutorial.continue': 'Continuar',
  'tutorial.exit': 'Salir',
  'tutorial.keepEditing': 'Seguir editando',
  'tutorial.ready': 'Listo para continuar',
  'tutorial.pending': 'Completa la instrucción para continuar',
  'tutorial.intro.title': 'Crea tu primera experiencia digital.',
  'tutorial.intro.body':
    'Puedes salir en cualquier momento y conservar tu trabajo. Pulsa Continuar para empezar.',
  'tutorial.name.title': 'Pon nombre a tu flujo',
  'tutorial.name.body':
    'Escribe un nombre para tu flujo en el campo de nombre; por ejemplo, «Mi primer flujo». Se acepta cualquier nombre no vacío distinto del predeterminado.',
  'tutorial.intro.about':
    'Una plataforma de experiencia digital (DXP) ayuda a los equipos a crear, gestionar y personalizar experiencias en canales digitales. Visual DXP se centra en sitios web: conectas disparadores y acciones en un flujo visual para decidir qué ven los visitantes y cuándo.',
  'tutorial.intro.exercise':
    'Crearás un flujo que muestra una ventana emergente tras una breve espera, lo probarás en el sitio de demostración y descubrirás herramientas para crear más.',
  'tutorial.intro.orientation':
    'Construye en el lienzo, añade pasos desde la biblioteca de nodos de arriba a la izquierda y selecciona un nodo para abrir sus ajustes a la derecha. Puedes salir en cualquier momento; tu trabajo se conserva.',
  'tutorial.learnMore': 'Acerca de DXP y el editor',
  'tutorial.website.title': 'Elige el sitio de demostración',
  'tutorial.website.body':
    'Los flujos añaden experiencias a un sitio web de destino. Abre el control del sitio, deja vacío el campo para usar la demostración y guarda. /demo-site.html no necesita credenciales ni instalación.',
  'tutorial.website.open': 'Elegir sitio web',
  'tutorial.website.demo': 'Usar sitio de demostración',
  'tutorial.trigger.title': 'Añade un disparador',
  'tutorial.trigger.body':
    'Un disparador determina cuándo comienza el flujo. Pulsa Disparador en la biblioteca o arrástralo al lienzo.',
  'tutorial.event.title': 'Confirma la carga de página',
  'tutorial.event.body':
    'Selecciona el Disparador y revisa Iniciar cuando. Elige La página se carga y confirma abajo. Así el flujo comienza al cargar la página de destino.',
  'tutorial.confirmEvent': 'Confirmar carga de página',
  'tutorial.showSettings': 'Mostrar ajustes del nodo',
  'tutorial.delay.title': 'Espera un segundo',
  'tutorial.delay.body':
    'Añade una Espera y abre sus ajustes. Configura Esperar en 1000 ms (1 segundo). Esto controla la espera antes de mostrar la ventana emergente.',
  'tutorial.popover.title': 'Añade una ventana emergente',
  'tutorial.popover.body':
    'Añade Ventana emergente desde la biblioteca y abre sus ajustes. Muestra contenido sobre el sitio web. Revisa Contenido HTML y Posición; conserva el HTML predeterminado y los demás ajustes para este ejercicio.',
  'tutorial.connect.title': 'Conecta el flujo',
  'tutorial.connect.body':
    'Separa los nodos en el lienzo. Arrastra desde el círculo de salida a la derecha del Disparador hasta la entrada a la izquierda de Espera; después conecta Espera con Ventana emergente. Con el teclado, selecciona cada nodo de origen y usa Conectar con en sus ajustes.',
  'tutorial.connectionHint': 'Disparador → Espera → Ventana emergente',
  'tutorial.test.title': 'Prueba tu flujo',
  'tutorial.test.body':
    'Abre Probar flujo. Abrir la vista previa no lo ejecuta: pulsa Ejecutar flujo dentro. Tras aproximadamente un segundo, aparecerá la ventana emergente predeterminada sobre el sitio de demostración.',
  'tutorial.openTest': 'Probar flujo',
  'tutorial.result.title': 'Tu ventana emergente funciona',
  'tutorial.result.body':
    '¡Creación y prueba completadas! Observa la ventana emergente y su entrada de éxito en el registro. Reiniciar vuelve a ejecutar el flujo; Detener termina la ejecución y elimina sus efectos. Cierra la vista previa para volver al editor y descubrir más herramientas.',
  'tutorial.closePreview': 'Volver al editor',
  'tutorial.ai.title': 'Descubre el chat de IA',
  'tutorial.ai.body':
    'Abre el chat de IA. Pide una ventana emergente para una promoción, anuncio, invitación a un boletín o cualquier otro contenido. Puede usar la identidad visual del sitio de destino para mantener el estilo de la marca.',
  'tutorial.ai.example':
    '«Crea una ventana emergente que anuncie nuestra colección de otoño usando la identidad visual de este sitio». ',
  'tutorial.ai.branding':
    'La identidad visual solo se usa si la comprobación de conexión ha capturado un perfil del sitio correspondiente. Tu sitio necesita el puente de Visual DXP configurado para este editor. La demostración no captura un perfil de marca. Aquí no hace falta enviar mensajes ni generar contenido.',
  'tutorial.ai.unavailable':
    'La IA usa un servidor de asistente configurado. Si no está disponible, configura o desbloquea un proveedor en Configuración de IA, o pide al anfitrión que configure el servicio. Puedes continuar sin credenciales ni solicitudes.',
  'tutorial.help.title': 'Descubre la ayuda del lienzo',
  'tutorial.help.body':
    'Abre Ayuda del lienzo para consultar cómo añadir, organizar, configurar y conectar nodos, los controles del lienzo y los atajos de teclado. Vuelve aquí para reanudar o repetir este tutorial.',
  'tutorial.export.title': 'Descubre la exportación',
  'tutorial.export.body':
    'Abre Exportar flujo. JavaScript exporta un script independiente para tu sitio; JSON del flujo de trabajo guarda una definición editable. Puedes usar Copiar y Descargar. Revisa las opciones y cierra el diálogo; no hace falta descargar. La demostración es para practicar: publicar requiere configurar y validar el sitio de destino real.',
  'tutorial.openExport': 'Abrir exportación',
  'tutorial.closeExport': 'Cerrar exportación',
  'tutorial.presets.title': 'Descubre las plantillas',
  'tutorial.presets.body':
    'Abre Plantillas. Son puntos de partida editables para experiencias web habituales. Explora los ejemplos disponibles indicados abajo. Aplicar una plantilla sustituye el nombre, los nodos y las conexiones mediante un cambio reversible y conserva el sitio de destino. Revísalas sin aplicar ninguna para conservar tu trabajo.',
  'tutorial.finish.title': 'Has creado una experiencia digital',
  'tutorial.finish.body':
    'Has creado nodos, configurado un disparador de carga de página y una espera de un segundo, conectado el flujo y probado la ventana emergente predeterminada. Sigue creando con las herramientas que acabas de explorar. Siempre puedes volver a este tutorial desde Ayuda del lienzo.',
  'tutorial.recovery':
    'Ha cambiado un requisito. Vuelve al paso indicado para corregirlo; tu trabajo se conserva.',
  'tutorial.repair': 'Revisar paso necesario',
  'tutorial.runtimeError':
    'La vista previa no pudo completar esta ejecución. Revisa el registro, confirma el sitio de demostración y los ajustes, y vuelve a cargar y ejecutar la vista previa.',
  'tutorial.reset.title': '¿Empezar un tutorial nuevo?',
  'tutorial.reset.body':
    'El lienzo contiene trabajo. Guarda una copia con la exportación antes de restablecerlo. Empezar de nuevo vacía el lienzo mediante un cambio reversible. Cancelar conserva todo.',
  'tutorial.restart': 'Vaciar lienzo y empezar',
  'tutorial.backup': 'Guardar JSON del flujo',
  'tutorial.mismatch.title': 'Revisa el progreso guardado',
  'tutorial.mismatch.body':
    'Este flujo no coincide con el tutorial guardado. Reanuda y corrige los pasos que falten en este lienzo o empieza de nuevo después de guardar tu trabajo.',
  'tutorial.resumeRepair': 'Reanudar y corregir',
  'tutorial.startOver': 'Empezar de nuevo…',
  'tutorial.workflowName': 'Nombre del flujo',
  'tutorial.connectTo': 'Conectar con',
  'tutorial.chooseTarget': 'Elige un nodo de destino',
  'tutorial.connectAction': 'Conectar nodos',
  'tutorial.backupNote':
    'JSON del flujo conserva este lienzo, incluido su destino de práctica o sin terminar. El despliegue de JavaScript requiere un destino de producción válido.',
};
