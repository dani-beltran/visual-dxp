import type { BuilderMessages } from '../../lib/i18n';

/** Complete Spanish builder catalog supplied by the demo app. */
export const spanishMessages = {
  'common.enterFullscreen': 'Entrar en pantalla completa',
  'common.exitFullscreen': 'Salir de pantalla completa',
  'nodeInspector.requestTemplates':
    'Usa datos de entrada en la URL o el cuerpo con {{name}} o {{user.name}}. También puedes usar índices como {{items[0].id}}. Conecta una respuesta HTTP a esta entrada para encadenar solicitudes. Las variables que faltan detienen la solicitud.',
  'errors.data.emptyRequestTemplatePath':
    'Introduce una ruta de datos entre las llaves de la plantilla de solicitud.',
  'errors.data.unclosedRequestTemplate':
    'Cierra las variables de la plantilla de solicitud con dos llaves de cierre.',
  'errors.data.unresolvedRequestTemplatePath': ({ path }: { path: string }) =>
    `No se ha podido resolver la ruta de datos «${path}» de la plantilla de solicitud.`,
  'nodeInspector.variablesHint':
    'Usa {{name}} o {{user.name}} en el contenido, los selectores o los nombres de atributo. Usa {{$}} para el valor completo seleccionado en la conexión. Las variables se rellenan al ejecutar este paso.',
  'nodeInspector.variablesIncomingHint':
    'Usa datos de entrada: las variables se resuelven desde la conexión entrante. Edita su asignación abajo para elegir los datos disponibles para este paso.',
  'mapping.variablesInactive':
    'Añade una variable como {{name}} o {{$}} al paso de destino para usar esta entrada.',
  'errors.data.emptyVariable':
    'Introduce un nombre de variable entre {{ }}; usa {{$}} para el valor de entrada completo.',
  'errors.data.unclosedVariable':
    'Cierra cada variable con sus llaves correspondientes, por ejemplo {{name}}.',
  'errors.data.missingTargetVariable': ({ name }) =>
    `Falta la variable «${name}» en el selector del elemento o el nombre del atributo.`,

  'mapping.title': 'Asignación de datos',
  'mapping.sourcePath': 'Ruta de datos de origen',
  'mapping.destination': 'Entrada de destino',
  'mapping.httpInputHint':
    'Los datos seleccionados están disponibles para las variables de la URL y el cuerpo de la petición. Este paso transmite su propia respuesta.',
  'mapping.inputData': 'Datos enviados al paso',
  'mapping.inputValue': 'Valor del elemento',
  'mapping.inputCondition': 'Valor de la condición',
  'mapping.pathHint':
    'Déjala vacía para usar el valor completo. Usa propiedades e índices, p. ej. data.items[0].price.',
  'mapping.forwardHint':
    'Los datos seleccionados se envían a este paso y se transmiten a los siguientes.',
  'mapping.consumeHint': 'Este paso usa el valor seleccionado y transmite los datos originales.',
  'mapping.preview': 'Última prueba',
  'mapping.unavailable':
    'No hay muestra disponible. Prueba el flujo para ver los valores. Las muestras grandes se omiten.',
  'mapping.sourceOutput': 'Salida de origen',
  'mapping.mappedValue': 'Valor asignado',
  'mapping.missing': 'Ausente: la ruta no corresponde a ningún valor.',
  'mapping.null': 'null (valor explícito)',
  'mapping.incompatible': 'Incompatible con el destino:',
  'mapping.importedResponse': 'Selección de respuesta importada',
  'mapping.importedHint':
    'Conserva la selección HTTP guardada antes de la ruta de origen. Se aplica a respuestas JSON correctas; el texto y los errores se transmiten completos.',
  'mapping.inactive':
    'Esta entrada está inactiva. Activa los datos entrantes en el paso de destino para usarla.',
  'mapping.configureConnections':
    'Elige el valor en Asignaciones entrantes o selecciona una conexión entrante.',
  'mapping.httpHint':
    'La respuesta completa está disponible en cada conexión saliente. Selecciona una conexión para elegir los datos que envía.',
  'mapping.incoming': 'Asignaciones entrantes',
  'mapping.noConnections': 'Conecta un paso para configurar sus datos entrantes.',
  'mapping.wholeValue': 'Valor completo',

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
  'aiSettings.selfHostedSetupInformation': 'Información de configuración del servidor propio',
  'aiSettings.enterTheApiBaseUrlOfYourSelfHostedOpenaiCompatibleModel':
    'Introduce la URL base de la API de tu servidor de modelos compatible con OpenAI. El backend de la aplicación debe poder acceder a la URL y el administrador debe permitirla. Un servidor alojado localmente en tu ordenador no funcionará porque el backend no podrá acceder a él. El modelo seleccionado debe admitir llamadas a herramientas para editar flujos de trabajo.',
  'aiSettings.unlockedUseActivateSavedConfigurationToSelectThisProvider':
    'Desbloqueado. Usa Activar configuración guardada para seleccionar este proveedor.',
  'aiSettings.selfHostedApiBaseUrl': 'URL base de la API del servidor propio',
  'aiSettings.apiKey': 'Clave de API',
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
  'canvasChat.explainTheConnectionsInThisWorkflow':
    'Explica las conexiones de este flujo de trabajo',
  'canvasChat.changeTheSelectedStep': 'Cambia el paso seleccionado',
  'canvasChat.stoppedNoChangesWereMade': 'Detenido. No se ha realizado ningún cambio.',
  'canvasChat.aiChat': 'Chat de IA',
  'canvasChat.yourWorkflowAssistant': 'Tu asistente de flujos de trabajo',
  'canvasChat.activeProvider': 'Proveedor activo:',
  'canvasChat.startANewConversation': 'Iniciar una nueva conversación',
  'canvasChat.newConversation': 'Nueva conversación',
  'canvasChat.closeAiChat': 'Cerrar chat de IA',
  'canvasChat.selected': 'Seleccionado:',
  'canvasChat.workingWithYourCurrentCanvas': 'Trabajando con tu lienzo actual',
  'canvasChat.aiProviderSettings': 'Configuración del proveedor de IA',
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
    'Arrastra los nodos para moverlos. Haz clic en un nodo para abrir su configuración, donde también puedes duplicarlo o eliminarlo.',
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
  'canvasHelp.dragEmptySpaceToPanScrollPinchOrUseTheZoomButtons':
    'Arrastra un espacio vacío para desplazarte. Usa la rueda, el gesto de pellizco o los botones de zoom para acercar o alejar. Ajustar todos los nodos muestra el recorrido completo; el minimapa ofrece una vista general.',
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
  'elementPicker.enterAValidWebsiteUrl': 'Introduce una URL de sitio web válida.',
  'elementPicker.thisWebsiteCouldnTConnectToThePickerCheckTheSetupBelow':
    'Este sitio web no ha podido conectarse al selector. Revisa la configuración de abajo y vuelve a pulsar Cargar sitio web.',
  'elementPicker.openDemoWebsite': 'Abrir sitio web de demostración',
  'elementPicker.selectAnElement': 'Seleccionar un elemento',
  'elementPicker.pointClickAndConnectYourExperience': 'Apunta, haz clic y conecta tu experiencia.',
  'elementPicker.closeElementPicker': 'Cerrar selector de elementos',
  'elementPicker.websiteUrl': 'URL del sitio web',
  'elementPicker.leaveEmptyToUseTheDemoWebsite':
    'Déjalo vacío para usar el sitio web de demostración',
  'elementPicker.loadWebsite': 'Cargar sitio web',
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
  'nodeInspector.details': 'DETALLES',
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
    'Introduce un objeto JSON. Déjalo vacío para usar las cabeceras predeterminadas.',
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
  'nodeInspector.useIncomingData': 'Usar datos de entrada',
  'nodeInspector.usesTheValueReceivedThroughTheBlueInputConnectionSuchAsAn':
    'Usa el valor recibido a través de la conexión de entrada azul, como una respuesta HTTP, para esta acción. El elemento de destino y el nombre del atributo se mantienen según la configuración.',
  'nodeInspector.incomingDataPath': 'Ruta de los datos de entrada',
  'nodeInspector.eGUserName': 'p. ej. user.name',
  'nodeInspector.optionalLeaveEmptyToUseTheWholeIncomingValueExamplesUserName':
    'Opcional. Déjalo vacío para usar todo el valor de entrada. Ejemplos: user.name o data.items[0].price. Las cadenas, los números y los booleanos se convierten en texto; null y los valores ausentes se convierten en texto vacío.',
  'nodeInspector.classNamesCanAlsoBeAnArrayOfStringsSeparateMultipleNames':
    ' Los nombres de clase también pueden ser un array de cadenas. Separa los nombres en el texto con espacios.',
  'nodeInspector.arraysAndObjectsBecomeJsonText':
    ' Los arrays y objetos se convierten en texto JSON.',
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
  'nodeInspector.timeOfDay': 'Hora del día',
  'nodeInspector.urlSearchParameter': 'Parámetro de búsqueda de la URL',
  'nodeInspector.cookies': 'Cookies',
  'nodeInspector.evaluatesDataReceivedThroughTheIncomingConnectionSuchAsAnHttpResponse':
    'Evalúa los datos recibidos a través de la conexión de entrada, como una respuesta HTTP. Elige un valor y un operador para dirigir la ejecución por Verdadero o Falso.',
  'nodeInspector.optionalLeaveEmptyToEvaluateAllIncomingDataExamplesUserNameData':
    'Opcional. Déjalo vacío para evaluar todos los datos de entrada. Ejemplos: user.name, data.items[0].price, items[2].tags.',
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
  'nodeInspector.false': 'Falso',
  'nodeInspector.conditionDoesNotMatch': 'La condición no se cumple',
  'nodeInspector.theMatchingOutputPassesAllIncomingDataUnchangedToTheNextStep':
    'La salida coincidente transmite los datos entrantes. Asigna la conexión entrante a Valor de la condición para elegir qué comparar sin cambiar los datos transmitidos.',
  'nodeInspector.body': 'Cuerpo',
  'nodeInspector.runsEachRepetition': 'Se ejecuta en cada repetición',
  'nodeInspector.done': 'Finalizado',
  'nodeInspector.runsAfterTheLastOne': 'Se ejecuta después de la última repetición',
  'nodeInspector.connectTheStepsToRepeatToBodyConnectTheNextStepTo':
    'Conecta los pasos que quieras repetir a Cuerpo. Conecta el siguiente paso a Finalizado.',
  'nodeInspector.data': 'Datos',
  'nodeInspector.next': 'Siguiente',
  'nodeInspector.responseDataPath': 'Ruta de los datos de respuesta',
  'nodeInspector.eGDataItems0Price': 'p. ej. data.items[0].price',
  'nodeInspector.responsesAreAutomaticallyParsedAsJsonWhenPossibleOptionallySelectAValue':
    'Las respuestas se interpretan automáticamente como JSON cuando es posible. Puedes seleccionar un valor con una ruta como user.name, data.items[0].price o items[2].tags; déjalo vacío para usar todo el cuerpo. Una ruta JSON inexistente devuelve undefined; null se pasa como null. Las respuestas que no son JSON ignoran la ruta y se pasan como texto completo.',
  'nodeInspector.duplicate': 'Duplicar',
  'nodeInspector.delete': 'Eliminar',
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
  'popoverPreview.popoverPreview': 'Vista previa de la ventana emergente',
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
    'Aplicar una plantilla reemplaza todos los nodos y conexiones actuales. El nombre del flujo de trabajo, el sitio web de destino y la configuración de subpáginas se mantienen. Puedes deshacer este cambio.',
  'presetsPanel.setupInstructions': 'Instrucciones de configuración',
  'presetsPanel.applyPreset': 'Aplicar plantilla',
  'preview.previewWorkflow': 'Vista previa del flujo de trabajo',
  'preview.testYourExperience': 'PRUEBA TU EXPERIENCIA',
  'preview.seeYourJourneyInAction': 'Ve tu recorrido en acción',
  'preview.closePreview': 'Cerrar vista previa',
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
  'builder.you': 'Tú',
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
  'workflowCard.usesTheWholeIncomingValue': 'Usa todo el valor de entrada',
  'workflowCard.templateVariables':
    'Las variables de este paso usan datos de su conexión entrante.',
  'workflowCard.usesIncomingData': 'Usa datos de entrada',
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
    'Elige la hora local del visitante o UTC para el intervalo de fechas.',
  'errors.dateRange.endDateMustBeOnOrAfterTheStartDate':
    'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
  'errors.timeRange.chooseVisitorLocalTimeOrUtcForTheTimeOf':
    'Elige la hora local del visitante o UTC para la hora del día.',
  'errors.data.dataPathMustBeText': 'La ruta de datos debe ser texto.',
  'errors.data.chooseManualValueOrIncomingDataAsTheValueSource':
    'Elige Valor manual o Datos de entrada como fuente del valor.',
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
    'Introduce una URL base de API local HTTP(S) válida sin credenciales, consulta ni fragmento.',
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
    'Inicia el flujo de trabajo cuando ocurre un evento seleccionado. Úsalo para responder a la actividad de la página o a las acciones del visitante. Elige un evento y los elementos de destino o umbrales necesarios y conecta el primer paso.',
  'nodes.http.description':
    'Envía una solicitud HTTP a una API. Úsalo para llamar a un servicio externo. Configura la URL y el método, con cabeceras o un cuerpo si hace falta.',
  'nodes.dom.description':
    'Actualiza los elementos coincidentes de la página. Úsalo para cambiar su contenido, apariencia o visibilidad. Elige un elemento de destino y una acción y usa un valor manual o los datos de entrada de un paso conectado. Configura el nombre del atributo cuando sea necesario.',
  'nodes.cookie.description':
    'Guarda una cookie en este sitio web. Úsalo para recordar un valor en pasos o visitas posteriores. Configura un nombre, valor y caducidad; un paso de Condición puede comprobar el valor guardado.',
  'nodes.delay.description':
    'Pausa el flujo de trabajo antes de continuar. Úsalo para espaciar los pasos conectados. Configura una duración en milisegundos; el siguiente paso se ejecuta después de la pausa.',
  'nodes.fork.description':
    'Elige una ruta según una condición. Úsalo para adaptar el flujo de trabajo al visitante o a la página. Elige un tipo de condición y sus valores y conecta la salida Verdadero cuando se cumpla y la salida Falso en caso contrario.',
  'nodes.loop.description':
    'Repite los pasos conectados. Úsalo para ejecutar la misma secuencia más de una vez. Configura el número de repeticiones, conecta los pasos a Cuerpo y el paso siguiente a Finalizado.',
  'nodes.popover.description':
    'Muestra un panel sobre la página. Úsalo para mostrar un mensaje o un sitio web incrustado. Proporciona HTML o una URL, elige una posición y un ancho y selecciona un elemento de anclaje si lo sitúas junto a un elemento.',
  'nodes.note.description':
    'Añade texto al lienzo. Úsalo para documentar ideas, contexto o recordatorios. Introduce el texto de la nota y elige su formato; las notas se omiten al ejecutar el flujo de trabajo.',
  'nodes.frame.description':
    'Agrupa nodos en el lienzo para que se muevan juntos. Úsalo para organizar partes relacionadas de un flujo de trabajo. Asigna un nombre al marco y coloca los nodos completamente dentro; los marcos se omiten al ejecutar el flujo de trabajo.',
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
  'workflowCard.incomingDataIncomingdatapath': ({ incomingDataPath }) =>
    `Datos de entrada: ${incomingDataPath}`,
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
  'activity.websiteChanged': ({ url }) => `Se cambió el sitio web de destino a «${url}»`,
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
  'errors.targeting.exportTargetMessageMessage': ({ EXPORT_TARGET_MESSAGE, message }) =>
    `${EXPORT_TARGET_MESSAGE} ${message}`,
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
    `Hora ${start}–${end} · ${zone === 'utc' ? 'UTC' : 'Hora local del visitante'}`,
  'summary.date': ({ start, end, zone }) =>
    `Del ${start} al ${end} · ${zone === 'utc' ? 'UTC' : 'Hora local del visitante'}`,
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
  'aiSettings.apiKeyLabel': ({ provider, optional }) =>
    `Clave de API de ${provider}${optional ? ' (opcional)' : ''}`,
  'aiSettings.modelLabel': ({ provider }) => `ID de modelo de ${provider}`,
  'aiSettings.confirmDestination': ({ previous, next }) =>
    `Destino guardado: ${previous}. ¿Permitir que esta configuración se envíe a ${next} durante esta sesión desbloqueada?`,
  'nodeInspector.detailsHeading': ({ kind }) => `DETALLES DE ${kind.toUpperCase()}`,
  'nodeInspector.annotationOutputs': ({ kind }) =>
    `Sin salidas. ${kind === 'note' ? 'Las notas' : 'Los marcos'} organizan el lienzo y no ejecutan pasos del flujo de trabajo.`,
  'nodeInspector.dateRangeHelp': ({ zone }) =>
    `Verdadero cuando la fecha actual está dentro de este intervalo. Se incluyen ambas fechas, usando ${zone === 'utc' ? 'UTC' : 'la zona horaria local del visitante'}.`,
  'nodeInspector.timeRangeHelp': ({ zone }) =>
    `Comprueba la hora actual usando ${zone === 'utc' ? 'UTC' : 'la zona horaria local del visitante'}. Se incluyen ambos minutos seleccionados. Una hora de fin anterior cruza la medianoche. Si las horas son iguales, solo coincide ese minuto.`,
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
