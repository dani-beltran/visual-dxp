import type { BuilderMessages } from '../../lib/i18n';
import { tutorialSpanish } from '../../tutorial/es';

/** Complete Spanish builder catalog supplied by the demo app. */
export const spanishMessages = {
  ...tutorialSpanish,
  'analytics.payload': 'Carga útil (JSON)',
  'analytics.payloadHint':
    'Objeto JSON opcional de parámetros del evento. No incluyas información personal.',
  'analytics.invalidPayload': 'Introduce un objeto JSON válido para la carga útil del evento.',
  'analytics.invalidPayloadKey':
    'Los nombres de parámetros deben empezar por una letra, tener hasta 40 letras, números o guiones bajos y no sobrescribir campos reservados de analítica.',
  'analytics.setupSuggestion':
    'Configura una integración de analítica para conocer cómo avanzan los visitantes por tus flujos, comparar experimentos y registrar hitos. Selecciona Google Analytics arriba para configurar la integración y consultar la guía.',
  'analytics.guide.title': 'Guía',
  'analytics.guide.intro':
    'Conecta Visual DXP con Google Analytics 4 (GA4) y convierte los eventos del flujo en informes útiles.',
  'analytics.guide.conceptsTitle': '1. Comprende qué se mide',
  'analytics.guide.concepts':
    'Visual DXP ejecuta el flujo y emite eventos. La etiqueta de Google o Google Tag Manager (GTM) del sitio los envía a GA4. Un evento registra algo que ocurrió; sus parámetros lo describen. Una dimensión personalizada permite usar un parámetro de texto en los informes. Enviar un evento y configurar un informe son pasos distintos.',
  'analytics.guide.identifiers':
    'El ID de medición G- identifica un flujo web de GA4. El ID del flujo identifica el recorrido; la versión para informes distingue sus revisiones. El ID del experimento identifica una asignación A/B y es distinto del ID de medición. Define ID estables antes de publicar. Si se omiten, se usan el nombre del flujo, la versión 1 y el ID del nodo para el experimento.',
  'analytics.guide.setupTitle': '2. Conecta el sitio y elige un método de envío',
  'analytics.guide.prerequisites':
    'Usa una propiedad GA4 con un flujo de datos web y una etiqueta de Google funcionando en el sitio de destino. Necesitas acceso al sitio o a su contenedor GTM y permisos de Editor en GA4 para configurar definiciones personalizadas. Visual DXP no instala etiquetas ni crea propiedades GA4.',
  'analytics.guide.configure':
    'Selecciona Google Analytics arriba, define el ID del flujo y la versión para informes, y elige Etiqueta de Google o Google Tag Manager. Usa una sola ruta para estos eventos para evitar duplicados. Sin seguimiento desactiva la integración compartida.',
  'analytics.guide.milestones':
    'Coloca nodos Registrar evento después de acciones o condiciones que confirmen hitos relevantes. Elige un nombre fijo como offer_accepted: entre 1 y 40 letras ASCII, números o guiones bajos, empezando por una letra. Se distinguen mayúsculas y minúsculas; se rechazan nombres y prefijos reservados como dxp_. Las asignaciones de experimentos se registran automáticamente.',
  'analytics.guide.deploy':
    'Exporta el flujo y carga su script en el sitio de destino configurado. La URL debe coincidir con el destino del script. Prueba un activador real en esa página; la vista previa del editor solo simula la analítica.',
  'analytics.guide.tagSetup':
    'Elige Etiqueta de Google si la página expone window.gtag. Visual DXP llama a su API de eventos. Deja vacío el ID de medición opcional para usar los destinos existentes o introduce el ID G- deseado para definir send_to. Este campo dirige los eventos; no instala ni inicializa Google Analytics. Carga la etiqueta existente antes de que pueda activarse el flujo.',
  'analytics.guide.gtmVariables':
    'En GTM, crea variables de capa de datos para los parámetros que enviarás, con los nombres exactos indicados abajo. Por ejemplo, llama a una variable DLV - workflow_id y establece su nombre de variable de capa de datos como workflow_id.',
  'analytics.guide.gtmTrigger':
    'Crea un activador de Evento personalizado independiente para cada uno de los tres nombres dxp_workflow_* y cada hito. Usa el nombre exacto, respetando mayúsculas. Por ejemplo, el activador del evento inicial coincide con dxp_workflow_started.',
  'analytics.guide.gtmTag':
    'Crea una etiqueta Google Analytics: evento de GA4 para cada evento, selecciona el ID de medición deseado y usa el nombre exacto del evento. Asocia los parámetros con las variables de capa de datos y añade el activador de Evento personalizado correspondiente. Un envío a dataLayer por sí solo no envía datos a GA4.',
  'analytics.guide.gtmOptional':
    'Asocia solo los parámetros que pertenecen a ese evento. Para los campos exclusivos del experimento en dxp_workflow_step, usa otra etiqueta y activador limitados a step_type = experiment y excluye esos pasos de la etiqueta general. Así evitas duplicados y valores opcionales antiguos retenidos en la capa de datos.',
  'analytics.guide.gtmPublish':
    'Usa Vista previa de GTM / Tag Assistant para verificar el evento y la activación de la etiqueta; después envía y publica los cambios del contenedor. Configura el destino GA4 en GTM; el ID de medición opcional de Visual DXP solo se usa con Etiqueta de Google.',
  'analytics.guide.gtmExample':
    'Ejemplo de nombre exacto para un activador de Evento personalizado. Crea los activadores correspondientes para los demás eventos de ejecución e hitos.',
  'analytics.guide.eventsTitle': '3. Conoce los eventos y sus parámetros',
  'analytics.guide.eventsCaption': 'Eventos emitidos por la integración compartida',
  'analytics.guide.event': 'Evento',
  'analytics.guide.meaning': 'Cuándo se envía y qué significa',
  'analytics.guide.started': 'Una vez por cada activación, antes de ejecutar su ruta.',
  'analytics.guide.step':
    'Tras una acción o condición correcta. Incluye step_id, step_type y step_index. Las condiciones y experimentos añaden branch; los experimentos también añaden experiment_id y variant_id (a o b).',
  'analytics.guide.completed':
    'Cuando la ejecución termina sin errores ni cancelación. Añade step_count. Significa que el flujo se ejecutó correctamente, no que el visitante convirtió. Las peticiones HTTP fallidas impiden este evento aunque continúe una ruta de error.',
  'analytics.guide.custom':
    'Nombre de ejemplo de un nodo Registrar evento. Se envía cada vez que se ejecuta ese nodo, con step_id y step_type. Define tus propios nombres; solo incluye los valores entrantes asignados explícitamente en Carga útil.',
  'analytics.guide.commonParameters':
    'Todos los eventos anteriores incluyen workflow_id, workflow_version, trigger_id y run_id. El ID de ejecución conecta los eventos de una activación, incluso si hay ejecuciones simultáneas. Los ID de nodo identifican los pasos; no son sus etiquetas editables. Consulta los ID emitidos en el registro de vista previa o en DebugView.',
  'analytics.guide.repetition':
    'Los activadores, notas y marcos no emiten eventos de paso. Los cuerpos de bucle y los hitos registran cada ejecución; el paso Bucle se registra tras sus iteraciones. Un nodo Registrar evento emite tanto su evento personalizado como el evento normal de paso.',
  'analytics.guide.verifyTitle': '4. Verifica la recogida antes de crear informes',
  'analytics.guide.preview':
    'Ejecuta la vista previa del editor y comprueba los nombres y parámetros simulados en el registro. La vista previa no envía eventos reales.',
  'analytics.guide.liveTest':
    'Prueba el script exportado en el sitio de destino con Vista previa de GTM / Tag Assistant o el modo de depuración GA4 activado mediante la etiqueta existente. Visual DXP no activa debug_mode automáticamente. Abre Administración → DebugView en GA4 y selecciona tu dispositivo de prueba.',
  'analytics.guide.inspect':
    'Activa el disparador, sigue la ruta prevista y revisa el orden, el ID del flujo, los ID de paso y la variante asignada. Verifica los hitos por separado. “En cola” en un registro de Visual DXP significa que la API del navegador aceptó el evento, no que GA4 lo recibiera.',
  'analytics.guide.troubleshoot':
    'Si faltan eventos, comprueba la URL de destino, el método de envío, la disponibilidad de la etiqueta, el ID de destino y los activadores y parámetros publicados en GTM. El consentimiento, los bloqueadores y los fallos de red pueden impedir la recogida. La falta de analítica no detiene las acciones; no desactives el consentimiento para probar.',
  'analytics.guide.dimensionsTitle': '5. Habilita los parámetros en los informes de GA4',
  'analytics.guide.dimensionsSetup':
    'En Administración → Definiciones personalizadas → Crear dimensión personalizada de GA4, indica un nombre legible, elige el ámbito Evento e introduce el nombre exacto del parámetro. Empieza por los campos que necesites; crear una dimensión no hace que Visual DXP envíe nuevos datos.',
  'analytics.guide.workflowDimensions': 'Filtra los resultados por flujo y revisión.',
  'analytics.guide.stepDimensions':
    'Identifica la acción, su tipo de nodo y el activador que inició la ejecución.',
  'analytics.guide.experimentDimensions':
    'Compara las asignaciones y rutas elegidas. Estos campos solo aparecen en los eventos de paso a los que corresponden.',
  'analytics.guide.numericParameters':
    'Orden numérico y recuento de pasos correctos. Si necesitas informes agregados, configura métricas personalizadas de evento adecuadas en lugar de dimensiones de texto.',
  'analytics.guide.runParameter':
    'Único por activación. Evita registrarlo como dimensión personalizada por su alta cardinalidad; úsalo para analizar eventos sin procesar.',
  'analytics.guide.dimensionValues':
    'Registra nombres de parámetros, no cada valor posible: los ID y a/b llegan automáticamente. Las nuevas dimensiones pueden tardar entre 24 y 48 horas en estar disponibles en informes. Usa DebugView para comprobar la recogida de inmediato.',
  'analytics.guide.reportingTitle': '6. Crea un embudo y compara experimentos',
  'analytics.guide.funnel':
    'En Explorar → Exploración de embudos de GA4, define los pasos por nombre de evento. Filtra por workflow_id y workflow_version. Usa nombres de hitos o dxp_workflow_step con una condición step_id. El ejemplo requiere añadir ambos hitos a las rutas correspondientes.',
  'analytics.guide.funnelRules':
    'Usa un embudo cerrado si los usuarios deben empezar por el primer paso, o abierto si pueden entrar por pasos posteriores. Prefiere pasos seguidos indirectamente cuando haya otros eventos intermedios. Define un intervalo adecuado. Los embudos de GA4 cuentan usuarios, no ejecuciones exactas; para analizarlas usa exportaciones agrupadas por run_id.',
  'analytics.guide.experiments':
    'El paso Experimento envía experiment_id y variant_id automáticamente. Crea segmentos a partir de la asignación y compara los hitos posteriores de A y B. Los eventos de hito no heredan variant_id; no asumas que basta con desglosarlos por variante. Mantén estable el ID durante la prueba; cambiarlo reinicia las asignaciones del navegador.',
  'analytics.guide.scope':
    'Visual DXP ejecuta el experimento y GA4 muestra las observaciones. No crea un experimento nativo de GA ni determina automáticamente la significación estadística. La guía de integración de Google incluye “In-house and custom experiments”. Un hito debe confirmar un resultado real; completar un flujo no equivale a convertir.',
  'analytics.guide.privacyTitle': '7. Datos y privacidad',
  'analytics.guide.privacy':
    'Visual DXP envía los metadatos integrados y los valores asignados explícitamente en Carga útil. No incluyas información personal ni secretos. Reutiliza la analítica y el consentimiento del sitio. Usa ID y nombres descriptivos sin información personal.',
  'analytics.guide.tagLink': 'Guía de Google: enviar eventos GA4',
  'analytics.guide.gtmLink': 'Guía de Google: configurar etiquetas de evento GA4',
  'analytics.guide.dimensionsLink': 'Guía de Google: dimensiones personalizadas de evento',
  'analytics.guide.debugLink': 'Guía de Google: DebugView',
  'analytics.guide.funnelLink': 'Guía de Google: exploración de embudos',
  'analytics.guide.experimentLink': 'Guía de Google: integración de experimentos',
  'analytics.gtmHint':
    'Envía eventos de flujo, hitos y experimentos a la capa de datos existente. Configura activadores de evento personalizado, variables de capa de datos y etiquetas de evento GA4 para cada nombre que quieras registrar.',
  'nodes.track-event.label': 'Registrar evento',
  'nodes.track-event.description':
    'Envía un evento personalizado mediante la integración de analítica del flujo. Úsalo para marcar un hito en una ruta.',
  'analytics.chooseEventName': 'Elige un nombre de evento',
  'analytics.eventName': 'Nombre del evento',
  'analytics.eventNameHint':
    'Usa de 1 a 40 letras, números o guiones bajos y empieza por una letra. Por ejemplo: oferta_aceptada. Se distinguen mayúsculas y minúsculas.',
  'analytics.invalidEventName':
    'Usa un nombre de 1 a 40 letras, números o guiones bajos que empiece por una letra.',
  'analytics.reservedEventName':
    'Elige un nombre de evento personalizado que no esté reservado por Google Analytics o Visual DXP.',
  'analytics.invalidIdentity':
    'El ID del flujo y la versión para informes deben contener de 1 a 100 caracteres.',
  'analytics.outputHint': 'Continúa al siguiente paso, aunque la analítica no esté disponible.',
  'analytics.milestoneHint':
    'Este nodo necesita una integración de analítica para enviar eventos. Configura una integración en la pestaña Analítica.',
  'analytics.customDisabledHint':
    'Activa Google Analytics en la pestaña Analítica para enviar eventos personalizados.',
  'analytics.workflowId': 'ID del flujo',
  'analytics.workflowIdHint':
    'ID estable enviado como workflow_id. Si no se configura, se usa el nombre del flujo. Mantén este ID al renombrar el flujo.',
  'analytics.workflowVersion': 'Versión para informes',
  'analytics.workflowVersionHint':
    'Se envía como workflow_version. Cámbiala al revisar el embudo para comparar los resultados por versión.',
  'analytics.lifecycleHint':
    'Envía automáticamente dxp_workflow_started al activarse un disparador, dxp_workflow_step tras cada acción o condición correcta y dxp_workflow_completed cuando la ejecución termina sin errores ni cancelación. Los bucles registran cada iteración; completar la ejecución no implica una conversión.',
  'analytics.funnelGuide': 'Configurar informes del embudo del flujo',
  'analytics.funnelGuideBody':
    'Registra dimensiones personalizadas de evento para workflow_id, workflow_version, step_id, step_type, trigger_id y branch según lo necesites. En Exploraciones de GA4, crea un embudo desde dxp_workflow_started, pasando por dxp_workflow_step filtrado por step_id o por tus eventos personalizados, hasta dxp_workflow_completed. En GTM, reenvía los tres eventos de ejecución y los nombres personalizados con activadores de evento, variables de capa de datos y etiquetas de evento GA4. Verifica los resultados en DebugView.',
  'analytics.runIdHint':
    'run_id agrupa los eventos de una activación, incluidas las ejecuciones simultáneas. Evita registrarlo como dimensión personalizada porque cada ejecución tiene un valor único. Los embudos de GA4 cuentan usuarios; usa exportaciones de eventos para analizar cada ejecución.',
  'builder.analytics': 'Analítica',
  'analytics.description':
    'Configura aquí el progreso del flujo, las asignaciones de experimentos y los hitos personalizados.',
  'analytics.openSettings': 'Abrir ajustes de analítica',
  'activity.analyticsUpdated': 'Ajustes de analítica actualizados',
  'errors.ai.invalid_workflow_edit':
    'La IA propuso un cambio de flujo inválido. No se aplicó ningún cambio. Prueba con una petición más específica.',
  'errors.ai.repeated_tool_loop':
    'La IA repitió un cambio sin avanzar. No se aplicó ningún cambio. Prueba con una petición más específica.',
  'nodes.experiment.label': 'Experimento',
  'nodes.experiment.description':
    'Distribuye los visitantes entre las variantes A y B. Prueba dos experiencias con un reparto de tráfico configurable y asignaciones estables por navegador.',
  'experiment.sharedAnalyticsHint':
    'Este experimento se registra automáticamente mediante la plataforma configurada en la pestaña Analítica. El seguimiento está desactivado si no hay ninguna plataforma habilitada.',
  'experiment.analytics': 'Analítica',
  'experiment.none': 'Sin seguimiento',
  'experiment.premium': 'Premium',
  'experiment.id': 'ID del experimento',
  'experiment.delivery': 'Envío de eventos',
  'experiment.gtag': 'Etiqueta de Google',
  'experiment.gtm': 'Google Tag Manager',
  'experiment.gtagHint':
    'Usa window.gtag ya instalado en el sitio. Deja vacío el ID de medición para usar sus destinos existentes.',
  'experiment.measurementId': 'ID de medición de GA4 (opcional)',
  'experiment.measurementIdHint':
    'Si el sitio web tiene varios destinos, introduce un ID para dirigir los eventos a un flujo de GA4 específico.',
  'experiment.privacyHint':
    'Solo usa el método de envío seleccionado. Visual DXP no instala otra etiqueta ni cambia el consentimiento del sitio. Un evento en cola no confirma la recepción; la analítica bloqueada o ausente no detiene el flujo. La vista previa simula eventos en el registro de ejecución.',
  'experiment.invalidPlatform': 'Elige una plataforma de analítica compatible.',
  'experiment.requiredId': 'Introduce un ID del experimento para analítica.',
  'experiment.requiredSelector': 'Elige un elemento CTA para analítica.',
  'experiment.invalidInteraction': 'Elige click o change para la interacción del CTA.',
  'experiment.invalidDelivery':
    'Elige el envío mediante la etiqueta de Google o Google Tag Manager.',
  'experiment.invalidMeasurementId':
    'Introduce un ID de medición GA4 válido, como G-XXXXXXXXXX, o déjalo vacío.',
  'experiment.trafficA': 'Tráfico a A (%)',
  'experiment.splitHint':
    'B recibe el tráfico restante. Los cambios se aplican a las nuevas asignaciones; los visitantes existentes conservan su variante.',
  'experiment.key': 'ID del experimento',
  'experiment.keyHint':
    'Obligatorio para Google Analytics. En los demás casos, si se deja vacío se usa el ID del nodo. Cambia el ID del experimento para iniciar un experimento nuevo. Los nodos con el mismo ID en este sitio comparten asignaciones. No es el ID de medición de GA.',
  'experiment.assignmentHint':
    'Las asignaciones se guardan en este navegador para este sitio. Si el almacenamiento no está disponible, como en la vista previa aislada, solo duran hasta reiniciar el flujo. Conecta A y B a las experiencias que quieras comparar. Las conversiones no se registran automáticamente.',
  'experiment.variantA': 'Variante A',
  'experiment.variantB': 'Variante B',
  'experiment.outputA': 'Se ejecuta para A.',
  'experiment.outputB': 'Se ejecuta para B.',
  'experiment.invalidOutput': 'Conecta los experimentos usando las salidas A o B.',
  'experiment.summary': ({ a, b }: { a: number; b: number }) => `A ${a}% · B ${b}%`,
  'nodes.transform.label': 'Transformación de datos',
  'nodes.transform.description':
    'Selecciona un campo de los datos entrantes y transforma su valor. El resultado se transmite a los siguientes pasos.',
  'transform.dataPath': 'Ruta de datos',
  'transform.pathHint':
    'Déjala vacía para seleccionar toda la entrada. Usa propiedades e índices, p. ej. user.items[0].name. Sin transformaciones, el valor extraído se transmite sin cambios.',
  'transform.wholeValue': 'Valor completo',
  'transform.transformations': 'Transformaciones',
  'transform.orderHint':
    'Se ejecutan de arriba abajo. Las operaciones de texto requieren texto. Añade primero un valor alternativo si el campo puede estar ausente o ser null.',
  'transform.capitalize': 'Primera letra mayúscula',
  'transform.lowercase': 'Minúsculas',
  'transform.uppercase': 'Mayúsculas',
  'transform.title-case': 'Iniciales mayúsculas',
  'transform.trim': 'Recortar espacios',
  'transform.prefix': 'Añadir prefijo',
  'transform.suffix': 'Añadir sufijo',
  'transform.replace': 'Buscar y reemplazar',
  'transform.fallback': 'Valor alternativo para ausente o null',
  'transform.textToAdd': 'Texto que añadir',
  'transform.find': 'Buscar',
  'transform.replacement': 'Reemplazar por',
  'transform.replaceHint':
    'Reemplaza todas las coincidencias exactas. El texto es literal; no se usan expresiones regulares.',
  'transform.fallbackType': 'Tipo de valor alternativo',
  'transform.fallbackValue': 'Valor alternativo',
  'transform.text': 'Texto',
  'transform.json': 'Valor JSON',
  'transform.invalidFallback':
    'Introduce JSON válido, como null, false, 0, "texto", un objeto o una matriz. Se guarda cuando el JSON es válido.',
  'transform.add': 'Añadir transformación',
  'transform.outputHint': 'Transmite el valor seleccionado y transformado al siguiente nodo',
  'transform.summary': ({ path, count }) =>
    `${path} · ${count} ${count === 1 ? 'transformación' : 'transformaciones'}`,
  'transform.operation': ({ number }) => `Transformación ${number}`,
  'transform.moveUp': ({ number }) => `Subir transformación ${number}`,
  'transform.moveDown': ({ number }) => `Bajar transformación ${number}`,
  'transform.remove': ({ number }) => `Eliminar transformación ${number}`,
  'common.enterFullscreen': 'Entrar en pantalla completa',
  'common.exitFullscreen': 'Salir de pantalla completa',
  'nodeInspector.requestTemplates':
    'Usa datos de entrada en la URL, las cabeceras o el cuerpo con {{name}} o {{user.name}}. También puedes usar índices como {{items[0].id}}. Las variables que faltan detienen la solicitud.',
  'errors.data.emptyRequestTemplatePath':
    'Introduce una ruta de datos entre las llaves de la plantilla de solicitud.',
  'errors.data.unclosedRequestTemplate':
    'Cierra las variables de la plantilla de solicitud con dos llaves de cierre.',
  'errors.data.unresolvedRequestTemplatePath': ({ path }: { path: string }) =>
    `No se ha podido resolver la ruta de datos «${path}» de la plantilla de solicitud.`,
  'errors.data.emptyVariable':
    'Introduce un nombre de variable entre {{ }}; usa {{$}} para el valor de entrada completo.',
  'errors.data.unclosedVariable':
    'Cierra cada variable con sus llaves correspondientes, por ejemplo {{name}}.',
  'errors.data.missingTargetVariable': ({ name }) =>
    `Falta la variable «${name}» en el selector del elemento o el nombre del atributo.`,

  'aiSettings.assistantCredentials': 'Credenciales del asistente',
  'aiSettings.aiSettings': 'Configuración de IA',
  'aiSettings.yourAiConnection': 'TU CONEXIÓN DE IA',
  'aiSettings.aiSettings2': 'Configuración de IA',
  'aiSettings.lockedUnlockToUseAi': 'Bloqueado — desbloquea para usar la IA',
  'aiSettings.unavailableRestoreOrRemoveBrowserSettings':
    'No disponible — restaura o elimina la configuración del navegador',
  'aiSettings.noSavedConfiguration': 'No hay configuración guardada',
  'aiSettings.browserSettingsReady': 'Configuración del navegador lista',
  'aiSettings.aiProviders': 'Proveedores de IA',
  'aiSettings.active': 'Activo',
  'aiSettings.invalidEndpoint': 'Endpoint no válido',
  'aiSettings.settingsUnavailable': 'Configuración no disponible.',
  'aiSettings.browserCredentialsRequireAnHttpsAiServer':
    'Las credenciales del navegador requieren un servidor de IA HTTPS.',
  'aiSettings.selfHostedSetupInformation': 'Información de configuración de Self-Hosted',
  'aiSettings.enterTheApiBaseUrlOfYourSelfHostedOpenaiCompatibleModel':
    'Conecta con un servidor de modelos compatible con OpenAI mediante cualquier URL base de API HTTP(S). Las solicitudes salen del backend, por lo que el servidor debe ser accesible desde allí; localhost se refiere a la máquina del backend. El modelo debe admitir llamadas a herramientas para editar flujos de trabajo.',
  'aiSettings.unlockedUseActivateSavedConfigurationToSelectThisProvider':
    'Desbloqueado. Usa Activar configuración guardada para seleccionar este proveedor.',
  'aiSettings.selfHostedApiBaseUrl': 'URL base de la API de Self-Hosted',
  'aiSettings.enterAKeyToReplaceSettingsUseActivateForSavedSettings':
    'Introduce una clave para reemplazar la configuración; usa Activar para la configuración guardada',
  'aiSettings.hideApiKey': 'Ocultar clave de API',
  'aiSettings.showApiKey': 'Mostrar clave de API',
  'aiSettings.enterAnAvailableModelId': 'Introduce el ID de un modelo disponible',
  'aiSettings.passphraseToUnlock': 'Frase de contraseña para desbloquear',
  'aiSettings.encryptionPassphraseAtLeast12Characters':
    'Frase de contraseña de cifrado (al menos 12 caracteres)',
  'aiSettings.unlockBrowserSettings': 'Desbloquear configuración del navegador',
  'aiSettings.saveAndActivate': 'Guardar y activar',
  'aiSettings.activateSavedConfiguration': 'Activar configuración guardada',
  'aiSettings.lock': 'Bloquear',
  'aiSettings.removeBrowserSettings': 'Eliminar configuración del navegador',
  'aiSettings.yourBrowserNormallyKeepsOtherWebsitesFromAccessingYourSavedApiKey':
    'Normalmente, tu navegador impide que otros sitios web accedan a tu clave de API guardada. Mientras la clave esté desbloqueada, el código malicioso de esta aplicación o las extensiones del navegador con permisos especiales podrían acceder a ella. Elige una frase de contraseña segura que no uses en otros sitios y guárdala bien: no podemos recuperarla si la olvidas.',
  'aiSettings.confirmNewServerOrigin': 'Confirmar nuevo origen del servidor',
  'activityPanel.today': 'Hoy',
  'activityPanel.yesterday': 'Ayer',
  'activityPanel.unknownDate': 'Fecha desconocida',
  'activityPanel.recentActivity': 'Actividad reciente',
  'activityPanel.seeWhoChangedThisWorkflowAndWhen':
    'Consulta quién cambió este flujo de trabajo y cuándo.',
  'activityPanel.unknownTime': 'Hora desconocida',
  'activityPanel.youReAllCaughtUp': 'Estás al día',
  'activityPanel.noActivityYet': 'Aún no hay actividad',
  'activityPanel.changesToThisWorkflowWillAppearHere':
    'Los cambios de este flujo de trabajo aparecerán aquí.',
  'canvasChat.addAWelcomePopoverAfterA2SecondDelay':
    'Añade una ventana emergente de bienvenida tras una espera de 2 segundos',
  'canvasChat.explainThisWorkflow': 'Explica qué hace este flujo de trabajo',
  'canvasChat.changeTheSelectedStep': 'Cambia los nodos seleccionados por',
  'canvasChat.explanationInterrupted':
    'La explicación se ha detenido. Los cambios del flujo se han aplicado. Usa Deshacer para revertirlos.',
  'canvasChat.stoppedNoChangesWereMade': 'Detenido. No se ha realizado ningún cambio.',
  'canvasChat.aiChat': 'Chat de IA',
  'canvasChat.yourWorkflowAssistant': 'Tu asistente de flujos de trabajo',
  'canvasChat.startANewConversation': 'Iniciar una nueva conversación',
  'canvasChat.newConversation': 'Nueva conversación',
  'canvasChat.closeAiChat': 'Cerrar chat de IA',
  'canvasChat.workingWithYourCurrentCanvas': 'Trabajando con tu lienzo actual',
  'canvasChat.aiConversation': 'Conversación de IA',
  'canvasChat.whatWouldYouLikeToCreate': '¿Qué te gustaría crear?',
  'canvasChat.askMeToAddStepsAdjustTheirSettingsOrConnectYourJourney':
    'Pídeme que añada pasos, ajuste su configuración o conecte tu recorrido.',
  'canvasChat.connectYourAiAssistant': 'Conecta tu asistente de IA',
  'canvasChat.aiChatIsReadyForSetupAskYourWorkspaceAdministratorToConnect':
    'El chat de IA está listo para configurarse. Pide al administrador de tu espacio de trabajo que conecte el servicio del asistente para habilitarlo.',
  'canvasChat.you': 'Tú',
  'canvasChat.visualDxpAi': 'IA de Visual DXP',
  'canvasChat.workingOnYourWorkflow': 'Trabajando en tu flujo de trabajo…',
  'canvasChat.reasoningSummary': 'Resumen del razonamiento',
  'canvasChat.messageTheWorkflowAssistant': 'Escribe al asistente de flujos de trabajo',
  'canvasChat.describeAChangeToYourWorkflow': 'Describe un cambio en tu flujo de trabajo…',
  'canvasChat.connectTheAssistantToStartChatting': 'Conecta el asistente para empezar a chatear',
  'canvasChat.stopGenerating': 'Detener generación',
  'canvasChat.sendMessage': 'Enviar mensaje',
  'canvasChat.changesAreUndoableTestYourWorkflowBeforePublishing':
    'Puedes deshacer los cambios. Prueba tu flujo de trabajo antes de publicarlo.',
  'canvasHelp.addAStep': 'Añadir un paso',
  'canvasHelp.clickAnIconInTheNodeLibraryOrDragItOntoThe':
    'Haz clic en un icono de la biblioteca de nodos o arrástralo al lienzo. Pasa el cursor sobre un icono para ver su nombre. Empieza tu recorrido con un Disparador.',
  'canvasHelp.arrangeAndConfigure': 'Organizar y configurar',
  'canvasHelp.dragNodesToMoveThemClickANodeToOpenItsSettings':
    'Arrastra los nodos para moverlos. Haz clic en un nodo para abrir su configuración, donde también puedes duplicarlo o eliminarlo. Mantén pulsada la tecla Mayús y haz clic en los nodos para añadirlos a la selección o quitarlos de ella. Mueve los nodos seleccionados juntos.',
  'canvasHelp.leaveANote': 'Dejar una nota',
  'canvasHelp.addANoteAndTypeDirectlyOnTheCanvasSelectTextThen':
    'Añade una Nota y escribe directamente en el lienzo. Selecciona texto y usa su configuración para ponerlo en negrita, cursiva o tachado. También puedes cambiar el fondo o elegir transparencia. Arrastra su cabecera para moverla.',
  'canvasHelp.groupNodesInAFrame': 'Agrupar nodos en un marco',
  'canvasHelp.addAFrameAndGiveItANameInItsSettingsDrop':
    'Añade un Marco y asígnale un nombre en su configuración. Suelta los nodos completamente dentro o cambia el tamaño del marco para rodearlos. Arrastra su cabecera para mover todo el grupo. Arrastra un nodo fuera para sacarlo del grupo; eliminar un marco conserva sus nodos.',
  'canvasHelp.connectYourSteps': 'Conectar tus pasos',
  'canvasHelp.dragFromTheCircleOnTheRightOfOneNodeToThe':
    'Arrastra desde el círculo de la derecha de un nodo hasta el de la izquierda de otro. Haz clic en una conexión para editar su nombre. Una Condición usa la salida superior cuando se cumple y la inferior en caso contrario.',
  'canvasHelp.moveAroundTheCanvas': 'Moverse por el lienzo',
  'canvasHelp.useVariables': 'Usar variables',
  'canvasHelp.useVariablesDescription':
    'Los nodos de petición HTTP producen datos que fluyen de un paso a otro por las conexiones. En cualquier parámetro de texto de un nodo, las variables se sustituyen por los campos de datos a los que apuntan cuando se ejecuta el flujo. Escribe Hola {{user.name}} para insertar un nombre, {{items[0].name}} para el primer elemento o {{$}} para el valor completo de entrada.',
  'canvasHelp.dragEmptySpaceToPanScrollPinchOrUseTheZoomButtons':
    'Mantén pulsada la tecla ⌘ / Ctrl y mueve el ratón para desplazarte sin hacer clic, o arrastra un espacio vacío como siempre. Usa la rueda, el gesto de pellizco o los botones de zoom para acercar o alejar. Ajustar todos los nodos muestra el recorrido completo; el minimapa ofrece una vista general.',
  'canvasHelp.canvasHelp': 'Ayuda del lienzo',
  'canvasHelp.howToUseTheCanvas': 'Cómo usar el lienzo',
  'canvasHelp.closeCanvasHelp': 'Cerrar ayuda del lienzo',
  'canvasHelp.canvasInstructions': 'Instrucciones del lienzo',
  'common.undo': 'Deshacer',
  'canvasHelp.ctrlZ': '⌘ / Ctrl + Z',
  'common.redo': 'Rehacer',
  'canvasHelp.ctrlShiftZ': '⌘ / Ctrl + Shift + Z',
  'canvasHelp.removeSelected': 'Eliminar selección',
  'canvasHelp.deleteBackspace': 'Supr / Retroceso',
  'edgeInspector.connectionConfiguration': 'Configuración de la conexión',
  'edgeInspector.connectionDetails': 'DETALLES DE LA CONEXIÓN',
  'edgeInspector.closeConnectionDetails': 'Cerrar detalles de la conexión',
  'edgeInspector.connection': 'Conexión',
  'edgeInspector.betweenWorkflowSteps': 'Entre pasos del flujo de trabajo',
  'edgeInspector.connectionName': 'Nombre de la conexión',
  'edgeInspector.eGContinueToWelcome': 'p. ej. Continuar a la bienvenida',
  'edgeInspector.shownOnTheConnectionLeaveEmptyToHideTheName':
    'Se muestra en la conexión. Déjalo vacío para ocultar el nombre.',
  'edgeInspector.deleteConnection': 'Eliminar conexión',
  'elementPicker.elementFoundOnThePage': 'Elemento encontrado en la página.',
  'elementPicker.noMatchingElementFoundYouCanStillUseThisSelector':
    'No se ha encontrado ningún elemento coincidente. Puedes seguir usando este selector.',
  'elementPicker.thisWebsiteCouldnTConnectToThePickerCheckTheSetupBelow':
    'Este sitio web no ha podido conectarse al selector. Revisa la configuración de abajo y vuelve a pulsar Cargar sitio web.',
  'elementPicker.selectAnElement': 'Seleccionar un elemento',
  'elementPicker.pointClickAndConnectYourExperience': 'Apunta, haz clic y conecta tu experiencia.',
  'elementPicker.closeElementPicker': 'Cerrar selector de elementos',
  'elementPicker.selectionModeIsOn': 'El modo de selección está activo',
  'elementPicker.connectingToWebsite': 'Conectando al sitio web…',
  'elementPicker.connectionRequired': 'Se requiere conexión',
  'elementPicker.hoverToInspectClickToSelect':
    'Pasa el cursor para inspeccionar · Haz clic para seleccionar',
  'elementPicker.websiteSetup': 'Configuración del sitio web',
  'elementPicker.websiteElementSelectionPreview':
    'Vista previa de selección de elementos del sitio web',
  'elementPicker.enterAWebsiteUrlToGetStarted': 'Introduce una URL de sitio web para empezar.',
  'elementPicker.connectingElementPicker': 'Conectando el selector de elementos',
  'elementPicker.elementSelected': 'Elemento seleccionado',
  'elementPicker.cssSelector': 'Selector CSS',
  'elementPicker.clickAnElementOrEnterACssSelector':
    'Haz clic en un elemento o introduce un selector CSS',
  'elementPicker.enterAValidCssSelector': 'Introduce un selector CSS válido.',
  'elementPicker.yourSelectorWillBeSavedToThisStep': 'Tu selector se guardará en este paso.',
  'common.cancel': 'Cancelar',
  'elementPicker.useElement': 'Usar elemento',
  'frameCard.dragToMoveThisFrameAndItsNodes': 'Arrastra para mover este marco y sus nodos',
  'frameCard.frame': 'Marco',
  'frameCard.dropNodesInsideToGroupThem': 'Suelta nodos dentro para agruparlos',
  'isolatedPreview.theDemoCouldNotLoadReloadToTryAgain':
    'No se ha podido cargar la demostración. Recarga para volver a intentarlo.',
  'isolatedPreview.theIsolatedPreviewCouldNotRunThisWorkflow':
    'La vista previa aislada no ha podido ejecutar este flujo de trabajo.',
  'isolatedPreview.step': 'Paso',
  'isolatedPreview.theWebsiteCouldNotLoad': 'No se ha podido cargar el sitio web.',
  'nodeInspector.runsWhenTheSelectedEventOccurs': 'Se ejecuta cuando ocurre el evento seleccionado',
  'nodeInspector.passesResponseDataOrAnErrorObjectToTheNextNode':
    'Pasa los datos de respuesta o un objeto de error al siguiente nodo',
  'nodeInspector.runsAfterTheElementsAreUpdated': 'Se ejecuta después de actualizar los elementos',
  'nodeInspector.runsAfterTheCookieIsSaved': 'Se ejecuta después de guardar la cookie',
  'nodeInspector.runsAfterThePause': 'Se ejecuta después de la pausa',
  'nodeInspector.runsAfterThePopoverIsDisplayed':
    'Se ejecuta después de mostrar la ventana emergente',
  'nodeInspector.targetElement': 'Elemento de destino',
  'nodeInspector.optionalWithoutAnAnchorChooseAFixedScreenPosition':
    'Opcional. Sin un elemento de anclaje, elige una posición fija en la pantalla.',
  'nodeInspector.useACssSelectorOrPickAnElementFromYourWebsite':
    'Usa un selector CSS o elige un elemento de tu sitio web.',
  'nodeInspector.eGSignupButton': 'p. ej. #signup-button',
  'nodeInspector.pickAnElementFromYourWebsite': 'Elige un elemento de tu sitio web',
  'nodeInspector.selectOnWebsite': 'Seleccionar en el sitio web',
  'nodeInspector.canvasGroup': 'Grupo del lienzo',
  'nodeInspector.canvasAnnotation': 'Anotación del lienzo',
  'nodeInspector.workflowStep': 'Paso del flujo de trabajo',
  'nodeInspector.frameName': 'Nombre del marco',
  'nodeInspector.noteName': 'Nombre de la nota',
  'nodeInspector.stepName': 'Nombre del paso',
  'nodeInspector.groupingNodes': 'Agrupación de nodos',
  'nodeInspector.textAppearance': 'Texto y apariencia',
  'nodeInspector.parameters': 'Parámetros',
  'nodeInspector.dropNodesFullyInsideThisFrameToGroupThemDragItsHeader':
    'Suelta los nodos completamente dentro de este marco para agruparlos. Arrastra su cabecera para mover el grupo o cambia el tamaño de sus bordes para rodear los nodos existentes. Arrastra un nodo fuera para liberarlo. Eliminar el marco conserva sus nodos y conexiones.',
  'nodeInspector.noteText': 'Texto de la nota',
  'nodeInspector.youCanAlsoEditThisTextDirectlyOnTheCanvas':
    'También puedes editar este texto directamente en el lienzo.',
  'nodeInspector.startWhen': 'Iniciar cuando',
  'nodeInspector.chooseASupportedTriggerEvent': 'Elige un evento de disparo compatible.',
  'nodeInspector.method': 'Método',
  'nodeInspector.requestUrl': 'URL de la solicitud',
  'nodeInspector.headers': 'Cabeceras',
  'nodeInspector.enterAJsonObjectLeaveEmptyForDefaultHeaders':
    'Introduce un objeto JSON con valores de texto. Déjalo vacío para usar las cabeceras predeterminadas.',
  'nodeInspector.requestBody': 'Cuerpo de la solicitud',
  'nodeInspector.sentAsTheRawRequestBody': 'Se envía como cuerpo de la solicitud sin procesar.',
  'nodeInspector.theApiMustAllowRequestsFromYourWebsiteThroughCors':
    'La API debe permitir solicitudes desde tu sitio web mediante CORS.',
  'nodeInspector.action': 'Acción',
  'nodeInspector.changeText': 'Cambiar texto',
  'nodeInspector.replaceHtml': 'Reemplazar HTML',
  'nodeInspector.addCssClass': 'Añadir clase CSS',
  'nodeInspector.removeCssClass': 'Eliminar clase CSS',
  'nodeInspector.hideElement': 'Ocultar elemento',
  'nodeInspector.showElement': 'Mostrar elemento',
  'nodeInspector.setAttribute': 'Establecer atributo',
  'nodeInspector.attributeName': 'Nombre del atributo',
  'nodeInspector.eGAriaLabel': 'p. ej. aria-label',
  'nodeInspector.htmlContent': 'Contenido HTML',
  'nodeInspector.cssClassNames': 'Nombres de clases CSS',
  'nodeInspector.attributeValue': 'Valor del atributo',
  'nodeInspector.newText': 'Texto nuevo',
  'nodeInspector.separateMultipleClassNamesWithSpaces': 'Separa los nombres de clase con espacios.',
  'nodeInspector.enterAValue': 'Introduce un valor…',
  'nodeInspector.cookieName': 'Nombre de la cookie',
  'nodeInspector.eGAudience': 'p. ej. audience',
  'nodeInspector.cookieValue': 'Valor de la cookie',
  'nodeInspector.anEmptyValueIsAllowed': 'Se permite un valor vacío.',
  'nodeInspector.eGReturning': 'p. ej. returning',
  'nodeInspector.expiration': 'Caducidad',
  'nodeInspector.browserSession': 'Sesión del navegador',
  'nodeInspector.afterANumberOfDays': 'Después de un número de días',
  'nodeInspector.expiresAfter': 'Caduca después de',
  'nodeInspector.from1To400Days': 'De 1 a 400 días.',
  'nodeInspector.days': 'días',
  'nodeInspector.savesTheCookieForAllPagesOnThisWebsiteALaterCondition':
    'Guarda la cookie para todas las páginas de este sitio web. Una Condición posterior puede comprobar su nombre y valor. La configuración de cookies del navegador puede impedir que se guarde.',
  'nodeInspector.waitFor': 'Esperar',
  'nodeInspector.1000Milliseconds1SecondMaximum24Hours':
    '1.000 milisegundos = 1 segundo. Máximo 24 horas.',
  'nodeInspector.ms': 'ms',
  'nodeInspector.conditionType': 'Tipo de condición',
  'nodeInspector.elementExists': 'Existe el elemento',
  'nodeInspector.incomingData': 'Datos de entrada',
  'nodeInspector.userDevice': 'Dispositivo del usuario',
  'nodeInspector.userLanguage': 'Idioma del usuario',
  'nodeInspector.referrerDomain': 'Dominio de referencia',
  'nodeInspector.withinDateRange': 'Dentro del intervalo de fechas',
  'nodeInspector.weekdays': 'Días de la semana',
  'nodeInspector.weekdaysHelp':
    'Coincide con cualquiera de los días seleccionados al evaluar la condición. Selecciona al menos un día.',
  'weekday.monday': 'Lunes',
  'weekday.tuesday': 'Martes',
  'weekday.wednesday': 'Miércoles',
  'weekday.thursday': 'Jueves',
  'weekday.friday': 'Viernes',
  'weekday.saturday': 'Sábado',
  'weekday.sunday': 'Domingo',
  'summary.weekdays': ({ days, zone }: { days: string; zone: string }) =>
    `${days} · ${zone.startsWith('UTC') ? zone : zone === 'utc' ? 'UTC' : 'Hora local del visitante'}`,
  'nodeInspector.fixedTimeZone': 'Zona horaria específica (desfase UTC)',
  'nodeInspector.utcOffset': 'Desfase UTC (horas)',
  'nodeInspector.utcOffsetHelp': 'De −12 a +14. Sin ajuste por horario de verano.',
  'nodeInspector.timeOfDay': 'Hora del día',
  'nodeInspector.urlSearchParameter': 'Parámetro de búsqueda de la URL',
  'nodeInspector.cookies': 'Cookies',
  'nodeInspector.evaluatesDataReceivedThroughTheIncomingConnectionSuchAsAnHttpResponse':
    'Evalúa los datos recibidos a través de la conexión de entrada, como una respuesta HTTP. Elige un valor y un operador para dirigir la ejecución por Verdadero o Falso.',
  'nodeInspector.operator': 'Operador',
  'nodeInspector.comparisonValue': 'Valor de comparación',
  'nodeInspector.trueWhenThisCssSelectorMatchesAnElement':
    'Verdadero cuando este selector CSS coincide con un elemento.',
  'nodeInspector.usesTheBrowserSDeviceInformationWithUserAgentDetectionAsA':
    'Usa la información del dispositivo del navegador y, como alternativa, la detección del agente de usuario.',
  'nodeInspector.checksThePrimaryBrowserLanguageUseEnForAnyEnglishVariantOr':
    'Comprueba el idioma principal del navegador. Usa en para cualquier variante del inglés o en-US para una configuración regional exacta.',
  'nodeInspector.matchesTheExactDomainIgnoringProtocolPortAndPathSubdomainsAreDistinct':
    'Coincide con el dominio exacto, ignorando protocolo, puerto y ruta. Los subdominios son distintos: example.com no coincide con www.example.com. Si no hay referente, se toma la ruta Falso.',
  'nodeInspector.checksTheCurrentPageUrlAnyMatchingValueInARepeatedParameter':
    'Comprueba la URL de la página actual. Cualquier valor coincidente de un parámetro repetido es válido.',
  'nodeInspector.checksCookiesLocalstorageAndSessionstorageOnThisWebsiteTrueIfAnySource':
    'Comprueba las cookies, localStorage y sessionStorage de este sitio web. Verdadero si alguna fuente contiene el nombre y el valor. Los nombres y valores de cookies se decodifican como URL. Si ninguno coincide, se ejecuta la ruta Falso.',
  'nodeInspector.exactCaseSensitiveMatchAnEmptyValueMatchesOnlyAPresentEmpty':
    'Coincidencia exacta que distingue mayúsculas y minúsculas. Un valor vacío solo coincide con una variable presente y vacía.',
  'nodeInspector.eGLoggedIn': 'p. ej. .logged-in',
  'nodeInspector.deviceIs': 'El dispositivo es',
  'nodeInspector.chooseADevice': 'Elige un dispositivo',
  'nodeInspector.desktop': 'Ordenador',
  'nodeInspector.mobile': 'Móvil',
  'nodeInspector.languageIs': 'El idioma es',
  'nodeInspector.eGEnEsEnUs': 'p. ej. en, es, en-US',
  'nodeInspector.referrerDomainEquals': 'El dominio de referencia es igual a',
  'nodeInspector.exampleCom': 'example.com',
  'nodeInspector.dateBasedOn': 'Fecha basada en',
  'nodeInspector.timeBasedOn': 'Hora basada en',
  'nodeInspector.visitorLocalDate': 'Fecha local del visitante',
  'nodeInspector.visitorLocalTime': 'Hora local del visitante',
  'nodeInspector.utc': 'UTC',
  'nodeInspector.startDate': 'Fecha de inicio',
  'nodeInspector.endDate': 'Fecha de fin',
  'nodeInspector.startTime': 'Hora de inicio',
  'nodeInspector.endTime': 'Hora de fin',
  'nodeInspector.parameterName': 'Nombre del parámetro',
  'nodeInspector.cookieOrStorageKey': 'Cookie o clave de almacenamiento',
  'nodeInspector.eGUtmSource': 'p. ej. utm_source',
  'nodeInspector.valueEquals': 'El valor es igual a',
  'nodeInspector.eGNewsletter': 'p. ej. newsletter',
  'nodeInspector.numberOfRepetitions': 'Número de repeticiones',
  'nodeInspector.times': 'veces',
  'nodeInspector.contentType': 'Tipo de contenido',
  'nodeInspector.customHtml': 'HTML personalizado',
  'nodeInspector.embeddedWebsite': 'Sitio web incrustado',
  'nodeInspector.websiteUrl': 'URL del sitio web',
  'nodeInspector.theWebsiteMustAllowEmbeddingInAnIframe':
    'El sitio web debe permitir su incrustación en un iframe.',
  'nodeInspector.popoverAnimation': 'Animación',
  'nodeInspector.animationNone': 'Ninguna',
  'nodeInspector.animationFade': 'Desvanecer',
  'nodeInspector.animationSlide': 'Deslizar',
  'nodeInspector.animationZoom': 'Ampliar',
  'nodeInspector.animationBounce': 'Rebotar',
  'nodeInspector.animationHint':
    'Previsualiza la animación en pantalla completa. La dirección sigue la posición del popover.',
  'nodeInspector.position': 'Posición',
  'nodeInspector.centerOfScreen': 'Centro de la pantalla',
  'nodeInspector.topLeft': 'Arriba a la izquierda',
  'nodeInspector.topRight': 'Arriba a la derecha',
  'nodeInspector.bottomLeft': 'Abajo a la izquierda',
  'nodeInspector.bottomRight': 'Abajo a la derecha',
  'nodeInspector.nextToAnElement': 'Junto a un elemento',
  'nodeInspector.anchorElement': 'Elemento de anclaje',
  'nodeInspector.popoverWidth': 'Ancho de la ventana emergente',
  'nodeInspector.chooseAWidthBetween240And960Pixels': 'Elige un ancho de entre 240 y 960 píxeles.',
  'nodeInspector.px': 'px',
  'nodeInspector.contentPreview': 'VISTA PREVIA DEL CONTENIDO',
  'nodeInspector.openFullscreenContentPreview':
    'Abrir vista previa del contenido a pantalla completa',
  'nodeInspector.previewOnTheDemoWebsite': 'Vista previa en el sitio web de demostración',
  'nodeInspector.fullscreen': 'Pantalla completa',
  'nodeInspector.popoverHtmlPreview': 'Vista previa del HTML de la ventana emergente',
  'nodeInspector.previewYourPopoverInPositionOnTheDemoWebsite':
    'Previsualiza tu ventana emergente en su posición en el sitio web de demostración.',
  'nodeInspector.outputs': 'Salidas',
  'nodeInspector.true': 'Verdadero',
  'nodeInspector.conditionMatches': 'La condición se cumple',
  'nodeInspector.conditionMatchesWithData': 'Reenvía datos si la condición se cumple',
  'nodeInspector.false': 'Falso',
  'nodeInspector.conditionDoesNotMatch': 'La condición no se cumple',
  'nodeInspector.conditionDoesNotMatchWithData': 'Reenvía datos si la condición no se cumple',
  'nodeInspector.body': 'Cuerpo',
  'nodeInspector.runsEachRepetition': 'Se ejecuta en cada repetición',
  'nodeInspector.done': 'Finalizado',
  'nodeInspector.runsAfterTheLastOne': 'Se ejecuta después de la última repetición',
  'nodeInspector.connectTheStepsToRepeatToBodyConnectTheNextStepTo':
    'Conecta los pasos que quieras repetir a Cuerpo. Conecta el siguiente paso a Finalizado.',
  'nodeInspector.data': 'Datos',
  'nodeInspector.next': 'Siguiente',
  'nodeInspector.actions': 'Acciones del nodo',
  'nodeInspector.edit': 'Editar',
  'nodeInspector.duplicate': 'Duplicar',
  'nodeInspector.delete': 'Eliminar',
  'nodeLibrary.moreNodes': 'Más nodos',
  'nodeLibrary.nodeLibrary': 'Biblioteca de nodos',
  'noteCard.dragToMoveNote': 'Arrastra para mover la nota',
  'noteCard.note': 'Nota',
  'noteControls.yellow': 'Amarillo',
  'noteControls.green': 'Verde',
  'noteControls.blue': 'Azul',
  'noteControls.purple': 'Morado',
  'noteControls.pink': 'Rosa',
  'noteControls.white': 'Blanco',
  'noteControls.transparent': 'Transparente',
  'noteControls.bold': 'Negrita',
  'noteControls.italic': 'Cursiva',
  'noteControls.strikethrough': 'Tachado',
  'noteControls.textStyle': 'Estilo de texto',
  'noteControls.selectTextInTheNoteOrAboveThenChooseAStyle':
    'Selecciona texto en la nota o arriba y elige un estilo.',
  'noteControls.background': 'Fondo',
  'noteControls.customBackgroundColor': 'Color de fondo personalizado',
  'noteControls.customColor': 'Color personalizado',
  'noteTextEditor.writeANote': 'Escribe una nota…',
  'popoverPreview.centerOfScreen': 'Centro de la pantalla',
  'popoverPreview.topLeft': 'Arriba a la izquierda',
  'popoverPreview.topRight': 'Arriba a la derecha',
  'popoverPreview.bottomLeft': 'Abajo a la izquierda',
  'popoverPreview.bottomRight': 'Abajo a la derecha',
  'popoverPreview.nextToAnElement': 'Junto a un elemento',
  'popoverPreview.fullscreenPopoverPreview':
    'Vista previa de la ventana emergente a pantalla completa',
  'popoverPreview.contentPreview': 'VISTA PREVIA DEL CONTENIDO',
  'popoverPreview.popover': 'Ventana emergente',
  'popoverPreview.restartPreview': 'Reiniciar vista previa',
  'popoverPreview.closePopoverPreview': 'Cerrar vista previa de la ventana emergente',
  'popoverPreview.closePreviewEsc': 'Cerrar vista previa (Esc)',
  'popoverPreview.demoWebsite': 'Sitio web de demostración',
  'popoverPreview.px': 'px',
  'popoverPreview.loadingWebsite': 'Cargando sitio web…',
  'popoverPreview.popoverPreviewWebsite': 'Sitio web de vista previa de la ventana emergente',
  'presetsPanel.workflowPresets': 'Plantillas de flujos de trabajo',
  'presetsPanel.applyingAPresetReplacesAllCurrentNodesAndConnectionsYourWorkflowName':
    'Aplicar una plantilla reemplaza el nombre del flujo de trabajo, los nodos y las conexiones actuales. El sitio web de destino y la configuración de subpáginas se mantienen. Puedes deshacer este cambio.',
  'presetsPanel.setupInstructions': 'Instrucciones de configuración',
  'presetsPanel.applyPreset': 'Aplicar plantilla',
  'preview.previewWorkflow': 'Vista previa del flujo de trabajo',
  'preview.testYourExperience': 'PRUEBA TU EXPERIENCIA',
  'preview.seeYourJourneyInAction': 'Ve tu recorrido en acción',
  'preview.closePreview': 'Cerrar vista previa',
  'preview.searchParams': 'Parámetros de búsqueda',
  'preview.reloadWebsite': 'Recargar sitio web',
  'preview.stopWorkflow': 'Detener flujo de trabajo',
  'preview.restartWorkflow': 'Reiniciar flujo de trabajo',
  'preview.runWorkflow': 'Ejecutar flujo de trabajo',
  'preview.workflowPreviewWebsite': 'Sitio web de vista previa del flujo de trabajo',
  'preview.executionLog': 'Registro de ejecución',
  'preview.listeningForYourTriggers': 'Esperando tus disparadores.',
  'preview.yourJourneyStepByStep': 'Tu recorrido, paso a paso.',
  'preview.interactWithTheWebsiteToTriggerYourWorkflow':
    'Interactúa con el sitio web para activar tu flujo de trabajo.',
  'preview.runTheWorkflowToSeeEachActionHappenOnThePage':
    'Ejecuta el flujo de trabajo para ver cada acción en la página.',
  'preview.externalWebsitesNeedThePreviewBridgeConfiguredForThisBuilderOriginPreviews':
    'Los sitios web externos necesitan el puente de vista previa configurado para el origen de este editor. Las vistas previas se ejecutan en un origen aislado. Los disparadores de carga de página se ejecutan al iniciar. Los demás responden a este sitio web igual que el script exportado. Recarga para restablecer los cambios de la página.',
  'builder.theActivityCouldNotBeSavedYourWorkflowEditIsStillApplied':
    'No se ha podido guardar la actividad. El cambio en tu flujo de trabajo sigue aplicado.',
  'builder.browserStorageIsUnavailableExportYourWorkflowToKeepACopy':
    'El almacenamiento del navegador no está disponible. Exporta tu flujo de trabajo para conservar una copia.',
  'builder.theChangeWasUndoneButItsActivityEntryCouldNotBeRemoved':
    'El cambio se ha deshecho, pero no se ha podido eliminar su entrada de actividad.',
  'builder.connectThisStepToADifferentStep': 'Conecta este paso a un paso diferente.',
  'builder.notesAreCanvasAnnotationsAndCannotBeConnected':
    'Las notas son anotaciones del lienzo y no se pueden conectar.',
  'builder.connectTheStepsInsideAFrameToBuildYourWorkflow':
    'Conecta los pasos dentro de un marco para crear tu flujo de trabajo.',
  'builder.triggersBeginAJourneyAndCannotReceiveConnections':
    'Los disparadores inician un recorrido y no pueden recibir conexiones.',
  'builder.invalidWorkflowStructure': 'Estructura del flujo de trabajo no válida.',
  'builder.chooseAValidVisualDxpWorkflowJsonFile':
    'Elige un archivo JSON de flujo de trabajo de Visual DXP válido.',
  'builder.workflowImported': 'Flujo de trabajo importado',
  'builder.couldNotImportThisFile': 'No se ha podido importar este archivo',
  'builder.targetWebsiteUpdated': 'Sitio web de destino actualizado',
  'builder.connectTheAssistantServiceToStartChatting':
    'Conecta el servicio del asistente para empezar a chatear.',
  'builder.theCanvasChangedWhileIWasWorkingSendYourMessageAgainTo':
    'El lienzo ha cambiado mientras trabajaba. Envía tu mensaje de nuevo para usar la última versión.',
  'builder.aiUpdatedYourWorkflowUseUndoToRevertThisChange':
    'La IA ha actualizado tu flujo de trabajo. Usa Deshacer para revertir este cambio.',
  'builder.builderViews': 'Vistas del editor',
  'builder.canvas': 'Lienzo',
  'builder.presets': 'Plantillas',
  'builder.activity': 'Actividad',
  'builder.aiSettings': 'Configuración de IA',
  'builder.allChangesSaved': 'Todos los cambios guardados',
  'builder.saving': 'Guardando…',
  'builder.readyToBuild': 'Listo para crear',
  'builder.changeTargetWebsite': 'Cambiar sitio web de destino',
  'builder.demoWebsite': 'Sitio web de demostración',
  'builder.undoZ': 'Deshacer (⌘Z)',
  'builder.redoZ': 'Rehacer (⌘⇧Z)',
  'builder.importAWorkflowJsonFile': 'Importar un archivo JSON de flujo de trabajo',
  'builder.import': 'Importar',
  'canvas.zoomOut': 'Alejar',
  'canvas.zoomIn': 'Acercar',
  'builder.fitAllNodes': 'Ajustar todos los nodos',
  'builder.toggleMinimap': 'Mostrar u ocultar minimapa',
  'builder.everyExperienceStartsSomewhere': 'Toda experiencia empieza en algún lugar.',
  'builder.addATriggerFromTheLibraryToBeginYourJourney':
    'Añade un disparador de la biblioteca para empezar tu recorrido.',
  'builder.addYourFirstTrigger': 'Añade tu primer disparador',
  'builder.step': 'Paso',
  'builder.createdWithLoveByDanielJLBeltran': 'CREADO CON CARIÑO POR DANIEL J.L. BELTRAN',
  'builder.reactFlowAttribution': 'BASADO EN REACT FLOW',
  'builder.zToUndo': 'Z para deshacer',
  'builder.dismissNotification': 'Descartar notificación',
  'builder.targetElementSelected': 'Elemento de destino seleccionado',
  'builder.targetWebsite': 'Sitio web de destino',
  'builder.yourDigitalExperience': 'TU EXPERIENCIA DIGITAL',
  'builder.chooseYourWebsite': 'Elige tu sitio web',
  'builder.closeDialog': 'Cerrar diálogo',
  'builder.thisExperienceWillRunOnlyOnThePageAtThisUrl':
    'Esta experiencia solo se ejecutará en la página de esta URL.',
  'builder.websiteUrl': 'URL del sitio web',
  'builder.leaveEmptyToUseTheDemoWebsite': 'Déjalo vacío para usar el sitio web de demostración',
  'builder.effectiveScope': 'Ámbito efectivo:',
  'builder.trailingSlashesQueryParametersAndFragmentsDoNotChangeTheScope':
    'Las barras finales, los parámetros de consulta y los fragmentos no cambian el ámbito.',
  'builder.includeSubpages': 'Incluir subpáginas',
  'builder.alsoRunThisExperienceOnPagesBeneathThisUrl':
    'Ejecutar también esta experiencia en las páginas bajo esta URL.',
  'builder.useTheDemoWebsite': 'Usar el sitio web de demostración',
  'website.save': 'Guardar sitio web',
  'websiteConnectionCheck.readingBranding': 'Leyendo el estilo de tu sitio web…',
  'websiteConnectionCheck.brandingUnavailable':
    'Sitio web conectado, pero no se pudo leer su estilo. Actualiza bridge.js a la última versión y vuelve a abrir este diálogo para reintentarlo.',
  'websiteConnectionCheck.brandingStorageUnavailable':
    'El estilo está disponible para esta sesión, pero no se pudo guardar en este navegador.',
  'websiteConnectionCheck.websiteConnectionCheck': 'Comprobación de conexión al sitio web',
  'websiteConnectionCheck.connectingToYourWebsite': 'Conectando a tu sitio web…',
  'websiteConnectionCheck.websiteConnectedSuccessfully': 'Sitio web conectado correctamente',
  'websiteConnectionCheck.connectionNeedsAttention': 'Tu conexión necesita atención',
  'websiteConnectionCheck.couldnTConnectToYourWebsiteCompleteTheSetupBelow':
    'No se ha podido conectar a tu sitio web. Completa la configuración de abajo.',
  'websiteSetup.connectYourWebsite': 'Conecta tu sitio web',
  'websiteSetup.copied': 'Copiado',
  'websiteSetup.copyScript': 'Copiar script',
  'isolatedPreview.bridgeUnavailable':
    'El puente de vista previa no se ha conectado. Instala bridge.js en este sitio web con data-parent-origin configurado con el origen exacto del editor y recarga. Revisa la consola del navegador por si hay scripts bloqueados o errores de incrustación.',
  'websiteSetup.couldnTCopyAutomaticallySelectTheScriptAboveAndCopyItManually':
    'No se ha podido copiar automáticamente. Selecciona el script de arriba y cópialo manualmente.',
  'workflowCard.incomingData': 'Datos de entrada',
  'workflowCard.usesIncomingData': 'Recibe datos',
  'workflowCard.producesData': 'Produce datos',
  'workflowCard.forwardsData': 'Reenvía datos',
  'workflowCard.running': 'En ejecución',
  'workflowCard.needsAttention': 'Requiere atención',
  'workflowCard.completed': 'Completado',
  'workflowCard.configured': 'Configurado',
  'workflowCard.2Paths': '2 RUTAS',
  'workflowCard.dataOut': 'SALIDA DE DATOS',
  'workflowCard.truePassesIncomingDataUnchanged':
    'Verdadero — pasa los datos de entrada sin modificarlos',
  'workflowCard.body': 'Cuerpo',
  'workflowCard.falsePassesIncomingDataUnchanged':
    'Falso — pasa los datos de entrada sin modificarlos',
  'workflowCard.done': 'Finalizado',
  'workflowCard.responseDataOutput': 'Salida de datos de respuesta',
  'errors.cookies.enterACookieNameWithoutSpacesOrSeparatorsSuchAs':
    'Introduce un nombre de cookie sin espacios ni separadores como = y ;.',
  'errors.cookies.missingNameVariable': ({ name }) =>
    `La variable «${name}» no está disponible en el nombre de la cookie.`,
  'errors.cookies.cookiesWithAnHttponlyNamePrefixMustBeSetBy':
    'Las cookies con un prefijo de nombre HttpOnly deben establecerse desde un servidor.',
  'errors.cookies.enterACookieValueAnEmptyStringIsAllowed':
    'Introduce un valor de cookie (se permite una cadena vacía).',
  'errors.cookies.cookieLifetimeMustBeAnIntegerFrom0SessionTo':
    'La duración de la cookie debe ser un número entero entre 0 (sesión) y 400 días.',
  'errors.cookies.cookieNamesAndValuesMustContainValidUnicodeText':
    'Los nombres y valores de cookies deben contener texto Unicode válido.',
  'errors.cookies.theEncodedCookieAndItsSettingsMustFitWithin4':
    'La cookie codificada y su configuración deben ocupar como máximo 4.096 bytes.',
  'errors.dateRange.chooseVisitorLocalTimeOrUtcForTheDateRange':
    'Elige la hora local del visitante, UTC o un desfase UTC fijo para el intervalo de fechas.',
  'errors.dateRange.endDateMustBeOnOrAfterTheStartDate':
    'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
  'errors.timeRange.chooseVisitorLocalTimeOrUtcForTheTimeOf':
    'Elige la hora local del visitante, UTC o un desfase UTC fijo para la hora del día.',
  'errors.data.dataPathMustBeText': 'La ruta de datos debe ser texto.',
  'errors.data.incomingCssClassesMustBeTextANumberABoolean':
    'Las clases CSS de entrada deben ser texto, un número, un booleano o un array de cadenas.',
  'errors.data.chooseASupportedIncomingDataConditionOperator':
    'Elige un operador compatible para la condición de datos de entrada.',
  'errors.data.enterAComparisonValueForTheIncomingDataCondition':
    'Introduce un valor de comparación para la condición de datos de entrada.',
  'errors.data.invalidRegularExpressionEnterAPatternSuchAsPremiumWithout':
    'Expresión regular no válida. Introduce un patrón como ^premium, sin delimitadores /.',
  'errors.data.numericComparisonsRequireValidFiniteNumbersOnBothSides':
    'Las comparaciones numéricas requieren números finitos válidos en ambos lados.',
  'errors.data.booleanComparisonsRequireTrueOrFalse':
    'Las comparaciones booleanas requieren true o false.',
  'errors.data.arrayAndObjectEqualityRequiresAValidJsonComparisonValue':
    'La igualdad de arrays y objetos requiere un valor de comparación JSON válido.',
  'errors.targeting.enterAWebsiteUrl': 'Introduce una URL de sitio web.',
  'errors.targeting.encodeSpacesInTheWebsiteUrl': 'Codifica los espacios en la URL del sitio web.',
  'errors.targeting.enterAValidHttpOrHttpsUrlForARelative':
    'Introduce una URL HTTP o HTTPS válida. Para una ruta relativa, proporciona baseUrl del editor.',
  'errors.targeting.enterAnHttpOrHttpsWebsiteUrlWithoutEmbeddedCredentials':
    'Introduce una URL de sitio web HTTP o HTTPS sin credenciales incrustadas.',
  'errors.targeting.chooseYourOwnWebsiteInsteadOfTheBuiltInDemo':
    'Elige tu propio sitio web en lugar de la demostración integrada.',
  'errors.targeting.includeSubpagesMustBeABoolean': 'Incluir subpáginas debe ser un booleano.',
  'errors.aiSettings.webCryptoIsUnavailableUseASecureBrowserContext':
    'Web Crypto no está disponible. Usa un contexto de navegador seguro.',
  'errors.aiSettings.aiConfigurationChangedSendYourMessageAgain':
    'La configuración de IA ha cambiado. Envía tu mensaje de nuevo.',
  'errors.aiSettings.browserSettingsCouldNotBeSavedEnableLocalstorageAndTry':
    'No se ha podido guardar la configuración del navegador. Habilita localStorage e inténtalo de nuevo. Se ha conservado la configuración activa anterior.',
  'errors.aiSettings.useAnHttpsAiServerBeforeSavingBrowserSettings':
    'Usa un servidor de IA HTTPS antes de guardar la configuración del navegador.',
  'errors.aiSettings.enterAValidApiKeyAndModelId':
    'Introduce una clave de API y un ID de modelo válidos.',
  'errors.aiSettings.keepCredentialsOutOfModelIdsAndUrls':
    'No incluyas credenciales en los ID de modelo ni en las URL.',
  'errors.aiSettings.useAPassphraseWithAtLeast12Characters':
    'Usa una frase de contraseña de al menos 12 caracteres.',
  'errors.aiSettings.settingsChangedSaveAgain': 'La configuración ha cambiado. Guarda de nuevo.',
  'errors.aiSettings.browserSettingsAreUnavailableRestoreStorageAccessOrRemoveThem':
    'La configuración del navegador no está disponible. Restaura el acceso al almacenamiento o elimínala.',
  'errors.aiSettings.couldNotUnlockSettingsCheckYourPassphraseOrRemoveSettings':
    'No se ha podido desbloquear la configuración. Comprueba tu frase de contraseña o elimina la configuración y guarda una clave nueva.',
  'errors.aiSettings.unlockThisProviderBeforeActivatingIt':
    'Desbloquea este proveedor antes de activarlo.',
  'errors.aiSettings.saveAConfigurationBeforeActivatingThisProvider':
    'Guarda una configuración antes de activar este proveedor.',
  'errors.aiSettings.browserCredentialsRequireAnHttpsAiServer':
    'Las credenciales del navegador requieren un servidor de IA HTTPS.',
  'errors.aiSettings.theAiServerOriginChangedConfirmTheNewDestinationIn':
    'El origen del servidor de IA ha cambiado. Confirma el nuevo destino en la configuración de IA o en el asistente antes de enviar.',
  'errors.aiCredentials.enterAValidHttpSLocalApiBaseUrlWithout':
    'Introduce una URL base de API HTTP(S) sin credenciales, consulta ni fragmento.',
  'errors.aiCredentials.configureAValidHttpOrHttpsAiEndpointWithoutEmbedded':
    'Configura un endpoint de IA HTTP o HTTPS válido sin credenciales incrustadas.',
  'errors.ai.idsCannotContainSurroundingWhitespaceOrControlCharacters':
    'Los ID no pueden contener espacios al principio o al final ni caracteres de control.',
  'errors.ai.stepPositionsMustContainFiniteCoordinatesWithinTheCanvasLimits':
    'Las posiciones de los pasos deben contener coordenadas finitas dentro de los límites del lienzo.',
  'errors.ai.stepConfigurationNumbersMustBeFinite':
    'Los números de configuración de los pasos deben ser finitos.',
  'errors.ai.noteTextFormattingMustContainBooleanValues':
    'El formato de texto de las notas debe contener valores booleanos.',
  'errors.ai.noteTextFormattingMustUseSortedNonoverlappingRangesWithinThe':
    'El formato de texto de las notas debe usar intervalos ordenados, sin solapamiento y dentro del texto de la nota.',
  'errors.ai.noteColorsMustBeASixDigitHexColorOr':
    'Los colores de las notas deben ser un color hexadecimal de seis dígitos o transparente.',
  'errors.ai.chooseASupportedWorkflowStepType':
    'Elige un tipo de paso de flujo de trabajo compatible.',
  'errors.ai.frameDimensionsMustBePositiveNumbers':
    'Las dimensiones del marco deben ser números positivos.',
  'errors.ai.connectionsMustUseASupportedOutputHandle':
    'Las conexiones deben usar un conector de salida compatible.',
  'errors.ai.connectionsCannotSpecifyTargetHandles':
    'Las conexiones no pueden especificar conectores de destino.',
  'errors.ai.anUpdateCannotChangeAStepTypeRemoveAndAdd':
    'Una actualización no puede cambiar el tipo de un paso; elimina el paso y añade otro.',
  'errors.ai.aStepUpdateMustContainAChange': 'La actualización de un paso debe contener un cambio.',
  'errors.ai.aConnectionUpdateMustContainAChange':
    'La actualización de una conexión debe contener un cambio.',
  'errors.ai.theAiResponseContainsAnUnsupportedWorkflowChange':
    'La respuesta de la IA contiene un cambio de flujo de trabajo no compatible.',
  'errors.ai.includeSubpagesMustBeABoolean': 'Incluir subpáginas debe ser un booleano.',
  'errors.ai.thisWorkflowVersionIsNotSupported':
    'Esta versión del flujo de trabajo no es compatible.',
  'errors.ai.everyStepMustHaveAUniqueId': 'Cada paso debe tener un ID único.',
  'errors.ai.nodesMustBelongToAnExistingTopLevelFrame':
    'Los nodos deben pertenecer a un marco de nivel superior existente.',
  'errors.ai.everyConnectionMustHaveAUniqueId': 'Cada conexión debe tener un ID único.',
  'errors.ai.aConnectionRefersToAMissingStep':
    'Una conexión hace referencia a un paso inexistente.',
  'errors.ai.notesCannotHaveWorkflowConnections':
    'Las notas no pueden tener conexiones de flujo de trabajo.',
  'errors.ai.framesCannotHaveWorkflowConnections':
    'Los marcos no pueden tener conexiones de flujo de trabajo.',
  'errors.ai.triggersCannotReceiveIncomingConnections':
    'Los disparadores no pueden recibir conexiones de entrada.',
  'errors.ai.aConnectionUsesAnInvalidOutputForItsSourceStep':
    'Una conexión usa una salida no válida para su paso de origen.',
  'errors.ai.duplicateConnectionsAreNotAllowed': 'No se permiten conexiones duplicadas.',
  'errors.ai.circularConnectionsAreNotSupportedUseARepeatStepInstead':
    'No se permiten conexiones circulares. Usa un paso de repetición.',
  'errors.ai.aStepWithThatIdAlreadyExists': 'Ya existe un paso con ese ID.',
  'errors.ai.theStepToUpdateDoesNotExist': 'El paso que se quiere actualizar no existe.',
  'errors.ai.theStepToRemoveDoesNotExist': 'El paso que se quiere eliminar no existe.',
  'errors.ai.aConnectionWithThatIdAlreadyExists': 'Ya existe una conexión con ese ID.',
  'errors.ai.theConnectionToUpdateDoesNotExist': 'La conexión que se quiere actualizar no existe.',
  'errors.ai.theConnectionToRemoveDoesNotExist': 'La conexión que se quiere eliminar no existe.',
  'errors.ai.chatMessagesMustHaveAUserOrAssistantRole':
    'Los mensajes de chat deben tener el rol de usuario o asistente.',
  'errors.ai.theLastChatMessageMustBeFromTheUser':
    'El último mensaje de chat debe ser del usuario.',
  'errors.ai.selectedStepsMustBeAnArrayOfStepIds':
    'Los pasos seleccionados deben ser un array de ID de pasos.',
  'errors.ai.selectedStepsMustIdentifyExistingStepsWithoutDuplicates':
    'Los pasos seleccionados deben identificar pasos existentes sin duplicados.',
  'errors.ai.thisWorkflowAndConversationAreTooLargeForAnAi':
    'Este flujo de trabajo y esta conversación son demasiado grandes para una solicitud de IA.',
  'errors.ai.theAiAssistantReturnedAResponseThatIsTooLarge':
    'El asistente de IA ha devuelto una respuesta demasiado grande.',
  'errors.ai.theAiAssistantReturnedAnInvalidResponseTryAgain':
    'El asistente de IA ha devuelto una respuesta no válida. Inténtalo de nuevo.',
  'errors.ai.chooseASupportedAiProvider': 'Elige un proveedor de IA compatible.',
  'errors.ai.browserCredentialsRequireHttpsAndConfirmationOfThisServerOrigin':
    'Las credenciales del navegador requieren HTTPS y la confirmación del origen de este servidor.',
  'errors.ai.browserAiSettingsAreIncompleteOrInvalidSaveAComplete':
    'La configuración de IA del navegador está incompleta o no es válida. Guarda una clave y un modelo completos.',
  'errors.ai.useBrowserAiSettingsForProviderCredentialsReserveAiHeaders':
    'Usa la configuración de IA del navegador para las credenciales del proveedor; reserva ai.headers para la autenticación de la aplicación.',
  'errors.ai.removeCredentialsFromYourConversationOrWorkflowBeforeSending':
    'Elimina las credenciales de tu conversación o flujo de trabajo antes de enviar.',
  'errors.ai.couldNotReachTheAiAssistantCheckTheConnectionAnd':
    'No se ha podido contactar con el asistente de IA. Comprueba la conexión e inténtalo de nuevo.',
  'errors.ai.aiServerRedirectsAreNotAllowedConfigureTheFinalHttps':
    'No se permiten redirecciones del servidor de IA. Configura el endpoint HTTPS final.',
  'errors.ai.theAiEndpointRejectedTheRequestCheckYourEndpointConfiguration':
    'El endpoint de IA ha rechazado la solicitud. Comprueba su configuración.',
  'errors.ai.thisProviderIsUnavailableInTheCurrentExecutionModeSave':
    'Este proveedor no está disponible en el modo de ejecución actual. Guarda su configuración en Configuración de IA.',
  'errors.ai.theAiAssistantIsBusyTryAgainInAMoment':
    'El asistente de IA está ocupado. Inténtalo de nuevo en un momento.',
  'errors.ai.theAiAssistantIsNotConfiguredOrIsTemporarilyUnavailable':
    'El asistente de IA no está configurado o no está disponible temporalmente.',
  'errors.ai.checkYourApiKeyAndModelInAiSettings':
    'Comprueba tu clave de API y el modelo en Configuración de IA.',
  'errors.ai.theAiRequestFailedTryAgainOrCheckAiSettings':
    'La solicitud de IA ha fallado. Inténtalo de nuevo o revisa Configuración de IA.',
  'errors.ai.theAiServerReturnedAnUnsafeResponseNoChangesWere':
    'El servidor de IA ha devuelto una respuesta insegura. No se ha aplicado ningún cambio.',
  'errors.ai.theAiAssistantTookTooLongToRespondTryAgain':
    'El asistente de IA ha tardado demasiado en responder. Inténtalo de nuevo.',
  'errors.picker.enterAWebsiteUrl': 'Introduce una URL de sitio web.',
  'errors.picker.enterAnHttpOrHttpsWebsiteUrl':
    'Introduce una URL de sitio web http:// o https://.',
  'errors.picker.useAWebsiteUrlWithoutEmbeddedCredentials':
    'Usa una URL de sitio web sin credenciales incrustadas.',
  'errors.picker.theWebsiteIsNotReadyYet': 'El sitio web aún no está listo.',
  'nodes.trigger.description':
    'Inicia el flujo de trabajo cuando ocurre un evento seleccionado. Úsalo para responder a la actividad de la página o a las acciones del visitante.',
  'nodes.http.description':
    'Envía una solicitud HTTP a una API. Úsalo para llamar a un servicio externo.',
  'nodes.dom.description':
    'Actualiza los elementos coincidentes de la página. Úsalo para cambiar su contenido, apariencia o visibilidad.',
  'nodes.cookie.description':
    'Guarda una cookie en este sitio web. Úsalo para recordar un valor en pasos o visitas posteriores.',
  'nodes.delay.description':
    'Pausa el flujo de trabajo antes de continuar. Úsalo para espaciar los pasos conectados.',
  'nodes.fork.description':
    'Elige una ruta según una condición. Úsalo para adaptar el flujo de trabajo al visitante o a la página.',
  'nodes.loop.description':
    'Repite los pasos conectados. Úsalo para ejecutar la misma secuencia más de una vez.',
  'nodes.popover.description':
    'Muestra un panel sobre la página. Úsalo para mostrar un mensaje o un sitio web incrustado.',
  'nodes.note.description':
    'Añade texto al lienzo. Úsalo para documentar ideas, contexto o recordatorios.',
  'nodes.frame.description':
    'Agrupa nodos en el lienzo para que se muevan juntos. Úsalo para organizar partes relacionadas de un flujo de trabajo.',
  'nodes.trigger.label': 'Disparador',
  'nodes.http.label': 'Solicitud HTTP',
  'nodes.dom.label': 'Actualizar elemento',
  'nodes.delay.label': 'Espera',
  'nodes.fork.label': 'Condición',
  'nodes.loop.label': 'Bucle',
  'nodes.popover.label': 'Ventana emergente',
  'nodes.cookie.label': 'Guardar cookie',
  'nodes.note.label': 'Nota',
  'nodes.frame.label': 'Marco',
  'triggers.thePageLoads': 'Se carga la página',
  'triggers.thisWorkflowStartsOnceThePageIsReady':
    'Este flujo de trabajo empieza cuando la página está lista.',
  'triggers.anElementIsClicked': 'Se hace clic en un elemento',
  'triggers.startsEachTimeAVisitorClicksTheSelectedElementOr':
    'Empieza cada vez que un visitante hace clic en el elemento seleccionado o en cualquier elemento de su interior.',
  'triggers.anElementIsHovered': 'El cursor pasa sobre un elemento',
  'triggers.startsEachTimeThePointerMovesOntoTheSelectedElement':
    'Empieza cada vez que el puntero entra en el elemento seleccionado o en uno de sus elementos hijos. Moverse entre elementos hijos puede activarlo de nuevo.',
  'triggers.aFormIsSubmitted': 'Se envía un formulario',
  'triggers.startsEachTimeTheSelectedFormIsSubmittedChooseThe':
    'Empieza cada vez que se envía el formulario seleccionado. Elige el formulario como elemento de destino.',
  'triggers.anInputChanges': 'Cambia un campo',
  'triggers.startsWhenAVisitorCommitsAChangeToTheSelected':
    'Empieza cuando un visitante confirma un cambio en el campo seleccionado, por ejemplo al elegir una opción, marcar una casilla o salir de un campo de texto tras editarlo.',
  'triggers.anElementIsZoomedInto': 'Se amplía un elemento',
  'triggers.startsOncePerPinchOrCtrlWheelZoomInGesture':
    'Empieza una vez por cada gesto de ampliación con pellizco o Ctrl+rueda sobre el elemento seleccionado o su contenido. Se ignoran el desplazamiento normal y los gestos de reducción.',
  'triggers.anElementIsSwiped': 'Se desliza sobre un elemento',
  'triggers.startsOnceWhenAFingerOrPenSwipeBeginsOn':
    'Empieza una vez cuando un gesto de deslizamiento con un dedo o lápiz comienza en el elemento seleccionado o su contenido y termina al menos 50 px más lejos en menos de un segundo, en cualquier dirección. Se ignoran los toques, arrastres lentos, pellizcos y gestos cancelados.',
  'triggers.exitIntention': 'Intención de salida',
  'triggers.startsOnceWhenTheMouseLeavesThroughTheTopOf':
    'Empieza una vez cuando el ratón sale por la parte superior de la página hacia los controles del navegador. Para visitantes que usan ratón.',
  'triggers.rageClicking': 'Clics de frustración',
  'triggers.detectsRapidClicksInTheSameAreaAnywhereOnThe':
    'Detecta clics rápidos en la misma zona en cualquier parte de la página. Cada grupo de clics coincidente inicia el flujo de trabajo.',
  'triggers.clickCount': 'Número de clics',
  'triggers.clickTimeWindowMs': 'Intervalo de clics (ms)',
  'triggers.clickRadiusPx': 'Radio de clics (px)',
  'triggers.inactivity': 'Inactividad',
  'triggers.startsAfterNoPointerKeyboardTouchOrScrollActivityRuns':
    'Empieza tras un periodo sin actividad del puntero, teclado, pantalla táctil ni desplazamiento. Se ejecuta una vez por periodo de inactividad y se reinicia al reanudarse la actividad. Se pausa en pestañas ocultas.',
  'triggers.inactivityDurationMs': 'Duración de la inactividad (ms)',
  'triggers.scrollThrashing': 'Desplazamiento errático',
  'triggers.detectsRapidUpDownDirectionChangesWhileScrollingThePage':
    'Detecta cambios rápidos de dirección hacia arriba y abajo al desplazar la página. Se ignoran los movimientos pequeños. Cada grupo coincidente inicia el flujo de trabajo.',
  'triggers.directionChanges': 'Cambios de dirección',
  'triggers.scrollTimeWindowMs': 'Intervalo de desplazamiento (ms)',
  'triggers.minimumScrollTravelPx': 'Recorrido mínimo de desplazamiento (px)',
  'triggers.scrollDownThreshold': 'Umbral de desplazamiento hacia abajo',
  'triggers.startsOnceWhenTheVisitorScrollsDownToThisPercentage':
    'Empieza una vez cuando el visitante alcanza este porcentaje de la distancia desplazable de la página. El 100 % corresponde al final de la página.',
  'triggers.scrollThreshold': 'Umbral de desplazamiento (%)',
  'validation.unsupportedTrigger': 'Elige un evento de disparo compatible.',
  'validation.aWorkflowMustContainArraysOfStepsAndConnections':
    'Un flujo de trabajo debe contener arrays de pasos y conexiones.',
  'validation.everyStepMustHaveAnIdTypeLabelAndConfiguration':
    'Cada paso debe tener un ID, tipo, etiqueta y objeto de configuración.',
  'validation.everyConnectionMustHaveAnIdSourceTargetAndValid':
    'Cada conexión debe tener un ID, origen, destino y conector de salida válido.',
  'validation.includeSubpagesMustBeABoolean': 'Incluir subpáginas debe ser un booleano.',
  'validation.thisWorkflowVersionIsNotSupported':
    'Esta versión del flujo de trabajo no es compatible.',
  'validation.addATriggerAndAStepToGetStarted': 'Añade un disparador y un paso para empezar.',
  'validation.addAtLeastOneTrigger': 'Añade al menos un disparador.',
  'validation.everyStepMustHaveAUniqueId': 'Cada paso debe tener un ID único.',
  'validation.unknownStepType': 'Tipo de paso desconocido.',
  'validation.nodesMustBelongToAnExistingTopLevelFrame':
    'Los nodos deben pertenecer a un marco de nivel superior existente.',
  'validation.frameDimensionsMustBePositiveNumbers':
    'Las dimensiones del marco deben ser números positivos.',
  'validation.stepTextParametersMustContainStrings':
    'Los parámetros de texto de los pasos deben contener cadenas.',
  'validation.noteTextFormattingMustUseSortedNonoverlappingRangesWithinThe':
    'El formato de texto de las notas debe usar intervalos ordenados, sin solapamiento y dentro del texto de la nota.',
  'validation.noteTextFormattingMustContainBooleanValues':
    'El formato de texto de las notas debe contener valores booleanos.',
  'validation.noteColorsMustBeASixDigitHexColorOr':
    'Los colores de las notas deben ser un color hexadecimal de seis dígitos o transparente.',
  'validation.chooseATargetElementForThisTrigger':
    'Elige un elemento de destino para este disparador.',
  'validation.enterAValidHttpOrHttpsRequestUrl':
    'Introduce una URL de solicitud HTTP o HTTPS válida.',
  'validation.chooseASupportedHttpMethod': 'Elige un método HTTP compatible.',
  'validation.headersMustBeAJsonObjectWithStringValues':
    'Las cabeceras deben ser un objeto JSON con valores de cadena.',
  'validation.chooseAnElementToUpdate': 'Elige un elemento que actualizar.',
  'validation.chooseASupportedElementAction': 'Elige una acción de elemento compatible.',
  'validation.enterAnAttributeName': 'Introduce un nombre de atributo.',
  'validation.delayMustBeBetween0And86400000Milliseconds':
    'La espera debe ser de entre 0 y 86.400.000 milisegundos.',
  'validation.chooseACssSelectorForTheBranchCondition':
    'Elige un selector CSS para la condición de bifurcación.',
  'validation.chooseDesktopOrMobileForTheDeviceCondition':
    'Elige ordenador o móvil para la condición de dispositivo.',
  'validation.enterALanguageCodeSuchAsEnEsOrEn':
    'Introduce un código de idioma como en, es o en-US.',
  'validation.enterAValidReferrerDomainSuchAsExampleCom':
    'Introduce un dominio de referencia válido como example.com.',
  'validation.enterANameForTheConditionVariable':
    'Introduce un nombre para la variable de la condición.',
  'validation.enterAnExpectedValueForTheConditionAnEmptyString':
    'Introduce un valor esperado para la condición (se permite una cadena vacía).',
  'validation.chooseASupportedConditionType': 'Elige un tipo de condición compatible.',
  'validation.repeatCountMustBeAnIntegerFrom1To1':
    'El número de repeticiones debe ser un entero entre 1 y 1.000.',
  'validation.chooseHtmlOrAnIframeForThePopoverContent':
    'Elige HTML o un iframe para el contenido de la ventana emergente.',
  'validation.chooseASupportedPopoverPosition':
    'Elige una posición compatible para la ventana emergente.',
  'validation.enterAValidHttpOrHttpsUrlForThePopover':
    'Introduce una URL HTTP o HTTPS válida para el iframe de la ventana emergente.',
  'validation.chooseAnAnchorElementForThePopover':
    'Elige un elemento de anclaje para la ventana emergente.',
  'validation.popoverWidthMustBeBetween240And960Pixels':
    'El ancho de la ventana emergente debe ser de entre 240 y 960 píxeles.',
  'validation.everyConnectionMustHaveAUniqueId': 'Cada conexión debe tener un ID único.',
  'validation.aConnectionRefersToAMissingStep':
    'Una conexión hace referencia a un paso inexistente.',
  'validation.notesCannotHaveWorkflowConnections':
    'Las notas no pueden tener conexiones de flujo de trabajo.',
  'validation.framesCannotHaveWorkflowConnections':
    'Los marcos no pueden tener conexiones de flujo de trabajo.',
  'validation.triggersCannotReceiveIncomingConnections':
    'Los disparadores no pueden recibir conexiones de entrada.',
  'validation.connectBranchesUsingTheYesOrNoOutputs':
    'Conecta las bifurcaciones mediante las salidas Sí o No.',
  'validation.connectRepeatsUsingTheRepeatOrDoneOutputs':
    'Conecta las repeticiones mediante las salidas Repetir o Finalizado.',
  'validation.circularConnectionsAreNotSupportedUseARepeatStepWith':
    'No se permiten conexiones circulares. Usa un paso de repetición con salidas Repetir y Finalizado separadas.',
  'data.hint.1':
    'Cadenas: subcadena que distingue mayúsculas y minúsculas. Arrays: elemento coincidente (JSON o texto plano; entrecomilla las cadenas numéricas, p. ej. "42"). Objetos: clave exacta.',
  'data.hint.2':
    'Usa el tipo de entrada: números, true/false, texto exacto que distingue mayúsculas y minúsculas o JSON para la igualdad profunda de arrays y objetos. Las cadenas con aspecto numérico siguen siendo texto.',
  'data.hint.3':
    'Comparación numérica. Los números y las cadenas numéricas solo se aceptan si ambos lados son números finitos válidos.',
  'data.hint.4':
    'Solo cadenas. Introduce una expresión regular que distinga mayúsculas y minúsculas sin delimitadores /, p. ej. ^premium o sale$.',
  'data.hint.5':
    'Vacío significa una cadena, array u objeto vacío. Los espacios en blanco, 0 y false no están vacíos. Null y los datos ausentes requieren sus propias comprobaciones.',
  'data.hint.6':
    'Existe incluye null. Es null y No es null requieren una ruta resuelta; los datos ausentes no cumplen ninguna de las dos condiciones.',
  'data.hint.7': 'Solo datos booleanos; las cadenas como "true" no son booleanos.',
  'data.hint.8': 'Solo cadenas. Comparación exacta de texto que distingue mayúsculas y minúsculas.',
  'data.operator.equal': 'Igual a',
  'data.operator.not-equal': 'Distinto de',
  'data.operator.greater-than': 'Mayor que',
  'data.operator.less-than': 'Menor que',
  'data.operator.greater-than-or-equal': 'Mayor o igual que',
  'data.operator.less-than-or-equal': 'Menor o igual que',
  'data.operator.contains': 'Contiene',
  'data.operator.not-contains': 'No contiene',
  'data.operator.matches': 'Coincide',
  'data.operator.not-matches': 'No coincide',
  'data.operator.starts-with': 'Empieza por',
  'data.operator.ends-with': 'Termina en',
  'data.operator.is-empty': 'Está vacío',
  'data.operator.is-not-empty': 'No está vacío',
  'data.operator.exists': 'Existe',
  'data.operator.not-exists': 'No existe',
  'data.operator.is-null': 'Es null',
  'data.operator.is-not-null': 'No es null',
  'data.operator.is-true': 'Es verdadero',
  'data.operator.is-false': 'Es falso',
  'flow.node.a11yDescription.default':
    'Pulsa Intro o Espacio para seleccionar un nodo. Pulsa Supr para eliminarlo y Escape para cancelar.',
  'flow.node.a11yDescription.keyboardDisabled':
    'Pulsa Intro o Espacio para seleccionar un nodo. Después puedes usar las flechas para moverlo. Pulsa Supr para eliminarlo y Escape para cancelar.',
  'flow.edge.a11yDescription.default':
    'Pulsa Intro o Espacio para seleccionar una conexión. Después puedes pulsar Supr para eliminarla o Escape para cancelar.',
  'flow.controls.ariaLabel': 'Panel de control',
  'flow.controls.zoomIn.ariaLabel': 'Acercar',
  'flow.controls.zoomOut.ariaLabel': 'Alejar',
  'flow.controls.fitView.ariaLabel': 'Ajustar vista',
  'flow.controls.interactive.ariaLabel': 'Activar o desactivar interacción',
  'flow.minimap.ariaLabel': 'Minimapa',
  'flow.handle.ariaLabel': 'Conector',
  'summary.chooseElement': 'Elige un elemento',
  'summary.pageLoad': 'Cuando un visitante llega a tu sitio',
  'summary.exitIntent': 'Cuando un visitante tiene intención de salir',
  'summary.configureUrl': 'Configura una URL',
  'summary.chooseCookie': 'Elige un nombre de cookie',
  'summary.dataLabel': 'Datos',
  'summary.chooseSelector': 'Elige un selector',
  'summary.chooseCondition': 'Elige un tipo de condición',
  'summary.writeNote': 'Escribe una nota…',
  'summary.frame': 'Mover juntos los nodos agrupados',
  'website.exportTargetRequired':
    'Configura la URL de tu sitio web antes de exportar. El sitio web de demostración solo sirve para la vista previa.',
  'canvasChat.unavailable': 'No se puede contactar con el asistente de IA.',
  'websiteSetup.embeddingInstructions':
    'El sitio web también debe permitir su incrustación mediante la configuración de CSP frame-ancestors y X-Frame-Options.',
  'aiSettings.privacy':
    'Tu clave de API se guarda cifrada en el localStorage de este navegador. Cuando usas el asistente de IA, se envía por HTTPS al servidor de IA configurado de la aplicación, que contacta con el proveedor seleccionado sin guardarla. Nunca se incluye en tu sitio publicado ni en las exportaciones de flujos de trabajo.',
  'aiSettings.storageUnavailable':
    'No se puede leer la configuración del navegador. Restaura el acceso al almacenamiento o elimina la configuración dañada antes de usar la IA.',
  'aiSettings.providerDamaged':
    'La configuración del navegador de este proveedor está dañada. Elimina o reemplaza su configuración.',
  'aiSettings.labelBrowserSettingsAreLockedUnlockBeforeUsingOrActivatingThem': ({ label }) =>
    `La configuración del navegador de ${label} está bloqueada. Desbloquéala antes de usarla o activarla.`,
  'aiSettings.labelSavedConfigurationIsReadySavedModelModel': ({ label, model }) =>
    `La configuración guardada de ${label} está lista. Modelo guardado: ${model}.`,
  'aiSettings.configureLabelBelowThenSaveAndActivateIt': ({ label }) =>
    `Configura ${label} abajo, guarda y activa la configuración.`,
  'aiSettings.labelSavedAndActivated': ({ label }) => `${label} guardado y activado.`,
  'aiSettings.labelActivatedUsingSavedSettings': ({ label }) =>
    `${label} activado con la configuración guardada.`,
  'aiSettings.labelConfigurationRemovedConfigureItAgainBelowWhenYouReReady': ({ label }) =>
    `Configuración de ${label} eliminada. Puedes volver a configurarlo abajo cuando quieras.`,
  'canvasChat.valueNoChangesWereMade': ({ value }) => `${value} No se ha realizado ningún cambio.`,
  'canvasChat.unlockActiveproviderInSettingsBelowToUseAi': ({ activeProvider }) =>
    `Desbloquea ${activeProvider} en la configuración de abajo para usar la IA`,
  'canvasChat.aiConfigurationIsIncorrectForActiveproviderCheckSettingsBelow': ({
    activeProvider,
  }) =>
    `La configuración de IA de ${activeProvider} no es correcta. Revisa la configuración de abajo.`,
  'nodeInspector.labelConfiguration': ({ label }) => `Configuración de ${label}`,
  'nodeInspector.closeItemnameDetails': ({ itemName }) => `Cerrar detalles de ${itemName}`,
  'nodeInspector.duplicateItemname': ({ itemName }) => `Duplicar ${itemName}`,
  'nodeInspector.deleteItemname': ({ itemName }) => `Eliminar ${itemName}`,
  'nodeLibrary.addLabel': ({ label }) => `Añadir ${label}`,
  'noteCard.valueText': ({ value }) => `Texto de ${value}`,
  'noteControls.labelBackground': ({ label }) => `Fondo ${label.toLowerCase()}`,
  'presetsPanel.applyPresetName': ({ name }) => `Aplicar plantilla: ${name}`,
  'builder.labelAdded': ({ label }) => `Se ha añadido ${label}`,
  'builder.couldNotApplyNameValue': ({ name, value }) =>
    `No se ha podido aplicar «${name}». ${value}`,
  'builder.appliedNameUseUndoToRestoreYourPreviousWorkflow': ({ name }) =>
    `Se ha aplicado «${name}». Usa Deshacer para restaurar el flujo de trabajo anterior.`,
  'activity.previewOpened': ({ name }) => `Se abrió una vista previa de prueba de «${name}»`,
  'activity.workflowRenamed': ({ name }) => `Se cambió el nombre del flujo de trabajo a «${name}»`,
  'activity.settingsUpdated': ({ label }) => `Se actualizó la configuración de «${label}»`,
  'activity.descriptionUpdated': ({ label }) => `Se actualizó la descripción de «${label}»`,
  'activity.nodeResized': ({ label }) => `Se cambió el tamaño de «${label}»`,
  'activity.nodeMoved': ({ label }) => `Se movió «${label}» en el lienzo`,
  'activity.nodesMoved': ({ count }) =>
    `Se ${count === 1 ? 'movió 1 paso' : `movieron ${count} pasos`} en el lienzo`,
  'activity.connected': ({ source, target }) => `Se conectó «${source}» a «${target}»`,
  'activity.disconnected': ({ source, target }) => `Se desconectó «${source}» de «${target}»`,
  'activity.nodeAdded': ({ label }) => `Se añadió «${label}»`,
  'activity.nodeDeleted': ({ label }) => `Se eliminó «${label}»`,
  'activity.nodeDuplicated': ({ label }) => `Se duplicó «${label}»`,
  'activity.presetApplied': ({ name }) => `Se aplicó la plantilla «${name}»`,
  'activity.workflowImported': ({ name }) => `Se importó el flujo de trabajo «${name}»`,
  'activity.websiteConfigured': ({ url, includeSubpages }) =>
    `Se cambió el sitio web de destino a «${url}» (${includeSubpages ? 'incluidas las subpáginas' : 'solo esta página'})`,
  'activity.aiEditsApplied': ({ count }) =>
    `Se ${count === 1 ? 'aplicó 1 cambio' : `aplicaron ${count} cambios`} con el asistente de IA`,
  'activity.deleted': ({ count, label, connections }) =>
    `${count === 1 ? `Se eliminó «${label}»` : `Se eliminaron ${count} pasos`}${connections ? ` y ${connections} ${connections === 1 ? 'conexión' : 'conexiones'}` : ''}`,
  'activity.connectionsRemoved': ({ count }) =>
    `Se ${count === 1 ? 'eliminó 1 conexión' : `eliminaron ${count} conexiones`}`,
  'activity.nodeRenamed': ({ kind, label }) =>
    `Se cambió el nombre de un ${kind === 'frame' ? 'marco' : 'paso'} a «${label}»`,
  'activity.connectionRenamed': ({ source, target, label }) =>
    label
      ? `Se cambió el nombre de la conexión de «${source}» a «${target}» por «${label}»`
      : `Se eliminó el nombre de la conexión de «${source}» a «${target}»`,
  'canvas.nodeCount': ({ count }) => `${count} ${count === 1 ? 'nodo' : 'nodos'}`,
  'nodeInspector.multipleNodes': 'Nodos seleccionados',
  'nodeInspector.closeSelectionDetails': 'Cerrar detalles de la selección',
  'nodeInspector.selectedNodeCount': ({ count }) => `${count} nodos seleccionados`,
  'nodeInspector.deleteNodes': 'Eliminar nodos',
  'canvas.connectionCount': ({ count }) => `${count} ${count === 1 ? 'conexión' : 'conexiones'}`,
  'activity.actionCount': ({ count }) => `${count} ${count === 1 ? 'acción' : 'acciones'}`,
  'errors.dateRange.chooseAValidLabelDateYyyyMmDd': ({ label }) =>
    `Elige una fecha de ${label === 'start' ? 'inicio' : label === 'end' ? 'fin' : label} válida (AAAA-MM-DD).`,
  'errors.timeRange.chooseAValidLabelTimeHhMmFrom0000': ({ label }) =>
    `Elige una hora de ${label === 'start' ? 'inicio' : label === 'end' ? 'fin' : label} válida (HH:MM, de 00:00 a 23:59).`,
  'errors.data.invalidDataPathPathUsePropertiesAndArrayIndexesE': ({ path }) =>
    `Ruta de datos «${path}» no válida. Usa propiedades e índices de arrays, p. ej. data.items[0].price.`,
  'errors.data.dataPathValue1CouldNotBeResolvedUseExistsOr': ({ value1 }) =>
    `No se ha podido resolver la ruta de datos «${value1}». Usa Existe o No existe para comprobar los datos ausentes.`,
  'errors.data.value1IsNotSupportedForTypeData': ({ value1, type }) =>
    `«${value1}» no es compatible con datos de tipo ${type}.`,
  'errors.data.enterAJsonTypeToCompareWithType2Data': ({ type, type2 }) =>
    `Introduce un valor JSON de tipo ${type} para compararlo con datos de tipo ${type2}.`,
  'errors.aiSettings.unlockValue1InAiSettingsBeforeUsingAi': ({ value1 }) =>
    `Desbloquea ${value1} en Configuración de IA antes de usar la IA.`,
  'errors.ai.labelMustBeAnObject': ({ label }) => `${label} debe ser un objeto.`,
  'errors.ai.labelMustBeValue2OfAtMostMaxCharacters': ({ label, value2, max }) =>
    `${label} debe ser ${value2 === 'text' ? 'una cadena' : value2 === 'nonempty text' ? 'una cadena no vacía' : value2} de como máximo ${max} caracteres.`,
  'errors.ai.anAiResponseMayContainAtMostOperationsChanges': ({ operations }) =>
    `Una respuesta de IA puede contener como máximo ${operations} cambios.`,
  'errors.ai.aiEditingSupportsUpToNodesStepsAndEdgesConnections': ({ nodes, edges }) =>
    `La edición con IA admite hasta ${nodes} pasos y ${edges} conexiones.`,
  'errors.ai.theProposedChangesAreIncompleteOrInvalidMessage': ({ message }) =>
    `Los cambios propuestos están incompletos o no son válidos: ${message}`,
  'errors.ai.anAiRequestNeedsBetween1AndMessagesMessages': ({ messages }) =>
    `Una solicitud de IA necesita entre 1 y ${messages} mensajes.`,
  'validation.triggerRange': ({ label, min, max }) =>
    `${label} debe ser un número entero entre ${min} y ${max}.`,
  'validation.invalidSelector': ({ value }) => `Selector CSS no válido: ${value}`,
  'flow.nodeMoved': ({ direction, x, y }) =>
    `Se ha movido el nodo seleccionado ${spanishDirections[direction] ?? direction}. Nueva posición, x: ${x}, y: ${y}`,
  'summary.rageClick': ({ count, seconds }) => `${count} clics cercanos en ${seconds} s`,
  'summary.inactivity': ({ seconds }) => `Tras ${seconds} s de inactividad`,
  'summary.scrollThrashing': ({ count, seconds }) =>
    `${count} cambios de dirección de desplazamiento en ${seconds} s`,
  'summary.scrollDepth': ({ percent }) => `Desplazarse hasta el ${percent} %`,
  'summary.elementEvent': ({ event, element }) => `${spanishEvents[event] ?? event} · ${element}`,
  'summary.http': ({ method, url }) => `${method}  ${url}`,
  'summary.dom': ({ action, element, incoming, path }) =>
    `${spanishActions[action] ?? action} · ${element}${incoming ? ` · Datos de entrada${path ? `: ${path}` : ''}` : ''}`,
  'summary.cookie': ({ name, value, days }) =>
    `${name} = ${value} · ${days ? `${days} ${days === 1 ? 'día' : 'días'}` : 'Sesión'}`,
  'summary.delay': ({ seconds }) => `Esperar ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`,
  'summary.data': ({ path, operator, value }) =>
    `${path} · ${operator.toLowerCase()}${value ? ` ${value}` : ''}`,
  'summary.time': ({ start, end, zone }) =>
    `Hora ${start}–${end} · ${zone.startsWith('UTC') ? zone : zone === 'utc' ? 'UTC' : 'Hora local del visitante'}`,
  'summary.date': ({ start, end, zone }) =>
    `Del ${start} al ${end} · ${zone.startsWith('UTC') ? zone : zone === 'utc' ? 'UTC' : 'Hora local del visitante'}`,
  'summary.selector': ({ selector }) => `${selector} existe en la página`,
  'summary.device': ({ value }) =>
    `El dispositivo es ${value === 'desktop' ? 'un ordenador' : value === 'mobile' ? 'un móvil' : value}`,
  'summary.language': ({ value }) => `El idioma es ${value}`,
  'summary.referrer': ({ value }) => `El dominio de referencia es igual a ${value}`,
  'summary.variable': ({ source, name, value }) =>
    `${source === 'cookie' ? 'Cookie' : 'Parámetro de URL'} ${name} = ${value}`,
  'summary.loop': ({ count }) => `Repetir ${count} ${count === 1 ? 'vez' : 'veces'}`,
  'summary.popover': ({ contentType, position }) =>
    `${contentType === 'iframe' ? 'Página incrustada' : 'HTML personalizado'} · ${spanishPositions[position] ?? position}`,
  'aiSettings.activeProvider': ({ label }) => `Proveedor activo: ${label}`,
  'aiSettings.noActiveProvider': 'Ningún proveedor activo',
  'canvasChat.checkAiConfiguration':
    'Revisa la configuración del servidor o guarda un proveedor en Configuración de IA.',
  'aiSettings.apiKeyLabel': ({ provider, optional }) =>
    `Clave de API de ${provider}${optional ? ' (opcional)' : ''}`,
  'aiSettings.modelLabel': ({ provider }) => `ID de modelo de ${provider}`,
  'aiSettings.confirmDestination': ({ previous, next }) =>
    `Destino guardado: ${previous}. ¿Permitir que esta configuración se envíe a ${next} durante esta sesión desbloqueada?`,
  'nodeInspector.detailsHeading': ({ kind }) => `DETALLES DE ${kind.toUpperCase()}`,
  'nodeInspector.annotationOutputs': ({ kind }) =>
    `Sin salidas. ${kind === 'note' ? 'Las notas' : 'Los marcos'} organizan el lienzo y no ejecutan pasos del flujo de trabajo.`,
  'nodeInspector.dateRangeHelp': ({ zone }) =>
    `Verdadero cuando la fecha actual está dentro de este intervalo. Se incluyen ambas fechas, usando ${zone.startsWith('UTC') ? zone : zone === 'utc' ? 'UTC' : 'la zona horaria local del visitante'}.`,
  'nodeInspector.timeRangeHelp': ({ zone }) =>
    `Comprueba la hora actual usando ${zone.startsWith('UTC') ? zone : zone === 'utc' ? 'UTC' : 'la zona horaria local del visitante'}. Se incluyen ambos minutos seleccionados. Una hora de fin anterior cruza la medianoche. Si las horas son iguales, solo coincide ese minuto.`,
  'canvasChat.editsApplied': ({ count }) =>
    `${count} ${count === 1 ? 'cambio aplicado' : 'cambios aplicados'} · Deshacer en el lienzo`,
  'websiteSetup.installInstructions': ({ filename }) =>
    `Añade este script ${filename} a las páginas de tu sitio web para seleccionar elementos y previsualizar los flujos.`,
  'canvasChat.selectedStep': ({ label }) => `Seleccionado: ${label}`,
  'website.exportTargetFailure': ({ reason }) =>
    `Configura la URL de tu sitio web antes de exportar. El sitio web de demostración solo sirve para la vista previa. ${reason}`,
} satisfies BuilderMessages;

const spanishDirections: Record<string, string> = {
  left: 'a la izquierda',
  right: 'a la derecha',
  up: 'hacia arriba',
  down: 'hacia abajo',
};
const spanishEvents: Record<string, string> = {
  'zoom-in': 'Ampliar',
  swipe: 'Deslizar',
  click: 'Clic',
  hover: 'Pasar el cursor',
  submit: 'Enviar',
  change: 'Cambiar',
};
const spanishActions: Record<string, string> = {
  text: 'Cambiar texto',
  html: 'Reemplazar HTML',
  'add-class': 'Añadir clase CSS',
  'remove-class': 'Eliminar clase CSS',
  hide: 'Ocultar',
  show: 'Mostrar',
  attribute: 'Establecer atributo',
};
const spanishPositions: Record<string, string> = {
  center: 'Centro',
  'top-left': 'Arriba a la izquierda',
  'top-right': 'Arriba a la derecha',
  'bottom-left': 'Abajo a la izquierda',
  'bottom-right': 'Abajo a la derecha',
  anchor: 'Junto a un elemento',
};
