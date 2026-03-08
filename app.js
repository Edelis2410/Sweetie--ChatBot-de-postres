/*
    Lógica principal
    Maneja la interacción con Ollama, la gestión de conversaciones múltiples,
    la persistencia y la interfaz de usuario dinámica.
    
*/


// Configuración de Ollama
const API_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma3:4b';

// Elementos del DOM
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sweetieWidget = document.querySelector('.sweetie-widget');
const sendBtn = document.getElementById('send-btn');
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const expandBtn = document.getElementById('expandBtn');
const chatContainer = document.querySelector('.chat-container');

let conversationToDelete = null;

// --- REFERENCIAS PARA EL HISTORIAL ---
const conversationList = document.getElementById('conversation-list');
const newChatBtn = document.getElementById('newChatBtn');

// System prompt base (se usará en todas las conversaciones)
const SYSTEM_PROMPT = `Eres Sweetie, una chef pastelera experta con mas de 20 años de experiencia. 
Tu misión es dar recetas de postres claras, cortas y directas.

REGLAS DE COMPORTAMIENTO:
1. FUERA DE TEMA: Si te preguntan algo que NO sea de repostería (ej. política, historia, programación), responde de forma muy amable pero breve: "¡Ups! Mi horno solo cocina dulces. 🥧 No sé de ese tema, pero puedo darte una receta de galletas si quieres."
2. CONTINUIDAD: Si el usuario te pregunta sobre un paso anterior o algo de la receta pasada, inicia tu respuesta diciendo: "¡Claro! Dándole continuidad a lo que preparábamos..." o "Sobre esa deliciosa receta anterior, te explico...".
3. REQUISITOS NUEVOS: Si el usuario pide algo totalmente nuevo, saluda con entusiasmo: "¡Manos a la obra! Aquí tienes una nueva delicia:".
4. FORMATO: Usa negritas para títulos. Lista de INGREDIENTES (con guiones) y PROCEDIMIENTO (numerado).
5. TONO: Dulce, profesional y usa muchos emojis de postres 🍰🍩🧁. Responde siempre en español.`;

// Estructura de conversaciones
let conversations = [];
let activeConversationId = null;

// Cargar conversaciones de localStorage o inicializar con una por defecto
function loadFromStorage() {
    const savedConversations = localStorage.getItem('sweetie_conversations');
    if (savedConversations) {
        conversations = JSON.parse(savedConversations);
        activeConversationId = localStorage.getItem('sweetie_active_conversation') || null;
        // Verificar que la activa exista, si no tomar la última
        if (!activeConversationId || !conversations.find(c => c.id === activeConversationId)) {
            if (conversations.length > 0) {
                activeConversationId = conversations[conversations.length - 1].id;
            } else {
                // No hay ninguna, crear por defecto
                createNewConversation(true);
            }
        }
    } else {
        // Primera vez: crear conversación por defecto
        createNewConversation(true);
    }
    renderActiveConversation();
    renderSidebar();
}

// Guardar conversaciones en localStorage
function saveConversationsToStorage() {
    localStorage.setItem('sweetie_conversations', JSON.stringify(conversations));
    if (activeConversationId) {
        localStorage.setItem('sweetie_active_conversation', activeConversationId);
    }
}

// Crear una nueva conversación (opcionalmente con mensaje de bienvenida)
function createNewConversation(withWelcome = true) {
    const newId = Date.now().toString();
    const newConv = {
        id: newId,
        title: 'Nueva conversación',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT }
        ]
    };
    if (withWelcome) {
        newConv.messages.push({ role: 'assistant', content: '¡Hola, soy Sweetie ¿Qué postre te gustaría preparar hoy? ✨' });
    }
    conversations.push(newConv);
    activeConversationId = newId;
    saveConversationsToStorage();
    return newConv;
}

// Eminina una nueva conversación 
function deleteConversation(conversationId){
    conversationToDelete = conversationId;
    deleteModal.classList.add("active");
}

confirmDeleteBtn.addEventListener("click", () => {

    conversations = conversations.filter(c => c.id !== conversationToDelete);
    if(activeConversationId === conversationToDelete){
        if(conversations.length > 0){
            activeConversationId = conversations[conversations.length-1].id;
        }else{
            createNewConversation(true);
        }
    }

    saveConversationsToStorage();
    renderSidebar();
    renderActiveConversation();

    deleteModal.classList.remove("active");
    conversationToDelete = null;
});

cancelDeleteBtn.addEventListener("click", () => {
    deleteModal.classList.remove("active");
    conversationToDelete = null;
});

// Renderizar el chat con los mensajes de la conversación activa
function renderActiveConversation() {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;
    chatBox.innerHTML = '';
    conv.messages.forEach(msg => {
        if (msg.role === 'system') return;
        const sender = msg.role === 'user' ? 'user' : 'bot';
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
        if (sender === 'bot') {
            messageDiv.innerHTML = formatBotText(msg.content);
        } else {
            messageDiv.textContent = msg.content;
        }
        chatBox.appendChild(messageDiv);
    });
    chatBox.scrollTop = 0;
}

// Renderizar el sidebar con la lista de conversaciones
function renderSidebar() {
    if (!conversationList) return;
    conversationList.innerHTML = '';
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        // Obtener título (primer mensaje de usuario o placeholder)
        const firstUserMsg = conv.messages.find(m => m.role === 'user');
        const title = firstUserMsg 
            ? (firstUserMsg.content.length > 20 ? firstUserMsg.content.substring(0,20)+'...' : firstUserMsg.content)
            : conv.title;
        
        item.innerHTML = `
            <span class="convo-icon">🧁</span>
            <div class="convo-info">
                <span class="convo-name">${title}</span>
                <span class="convo-preview">${conv.messages.length-1} mensajes</span>
            </div>

            <button class="delete-convo-btn" data-id="${conv.id}">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        const deleteBtn = item.querySelector('.delete-convo-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            deleteConversation(conv.id);
        });

        item.addEventListener('click', () => {
            activeConversationId = conv.id;
            renderActiveConversation();
            saveConversationsToStorage();
            closeSidebar();
        });
        conversationList.appendChild(item);
    });
}

// Formatear texto del bot
function formatBotText(text) {
    let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    const lines = escaped.split('\n');
    let html = '';
    let inList = false;
    let currentListType = null; 

    for (let line of lines) {
        const trimmed = line.trim();
        const isIngredient = trimmed.startsWith('-') || trimmed.startsWith('*');
        const isStep = /^\d+[\.\)]/.test(trimmed);

        if (isIngredient) {
            if (currentListType !== 'ul') {
                if (inList) html += (currentListType === 'ol' ? '</ol>' : '</ul>');
                html += '<ul>';
                inList = true;
                currentListType = 'ul';
            }
            html += `<li>${trimmed.replace(/^[-*]\s*/, '')}</li>`;
        } 
        else if (isStep) {
            if (currentListType !== 'ol') {
                if (inList) html += (currentListType === 'ol' ? '</ol>' : '</ul>');
                html += '<ol>';
                inList = true;
                currentListType = 'ol';
            }
            html += `<li>${trimmed.replace(/^\d+[\.\)]\s*/, '')}</li>`;
        } 
        else if (trimmed === "" && inList) continue; 
        else {
            if (inList) {
                html += (currentListType === 'ol' ? '</ol>' : '</ul>');
                inList = false;
                currentListType = null;
            }
            if (trimmed !== "") html += trimmed + '<br>';
        }
    }
    if (inList) html += (currentListType === 'ol' ? '</ol>' : '</ul>');
    return html;
}

// Añadir mensaje al DOM (sin tocar el array de mensajes)
function addMessageToDOM(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    if (sender === 'bot') {
        messageDiv.innerHTML = formatBotText(text);
    } else {
        messageDiv.textContent = text;
    }
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Limitar el historial de la conversación activa
function trimHistory(conv) {
    const MAX_HISTORY = 10;
    if (conv.messages.length > MAX_HISTORY + 1) {
        conv.messages = [conv.messages[0], ...conv.messages.slice(-MAX_HISTORY)];
    }
}

// Enviar mensaje a Ollama
async function sendToOllama() {
    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    const activeConv = conversations.find(c => c.id === activeConversationId);
    if (!activeConv) return;

    // Añadir mensaje del usuario al array y al DOM
    activeConv.messages.push({ role: 'user', content: userMessage });
    addMessageToDOM(userMessage, 'user');
    userInput.value = '';

    // Si es el primer mensaje de usuario, actualizar el título de la conversación
    const userMessagesCount = activeConv.messages.filter(m => m.role === 'user').length;
    if (userMessagesCount === 1) {
        activeConv.title = userMessage.length > 30 ? userMessage.substring(0,30)+'…' : userMessage;
        renderSidebar(); // Actualizar el sidebar con el nuevo título
    }

    // Mostrar indicador de escritura
    const thinkingDiv = document.createElement('div');
    thinkingDiv.classList.add('message', 'bot-message');
    thinkingDiv.style.fontStyle = 'italic';
    thinkingDiv.textContent = 'Horneando respuesta... 🧁';
    thinkingDiv.id = 'thinking';
    chatBox.appendChild(thinkingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                messages: activeConv.messages, // Enviamos todo el historial de esta conversación
                stream: false,
                options: {
                    temperature: 0.6,
                    num_predict: 600,
                    num_thread: 2
                }
            })
        });

        if (!response.ok) throw new Error('Error en la conexión');

        const data = await response.json();
        const botReply = data.message.content;

        // Eliminar indicador de escritura
        const thinkingElement = document.getElementById('thinking');
        if (thinkingElement) thinkingElement.remove();

        // Añadir respuesta del bot
        activeConv.messages.push({ role: 'assistant', content: botReply });
        addMessageToDOM(botReply, 'bot');
        
        // Cambiar el fondo según la receta
        cambiarFondoPorReceta(botReply);

        // Limitar historial (opcional)
        trimHistory(activeConv);

        // Guardar todo
        saveConversationsToStorage();
        renderSidebar(); // Actualizar contador de mensajes en el sidebar

    } catch (error) {
        const thinkingElement = document.getElementById('thinking');
        if (thinkingElement) thinkingElement.remove();
        addMessageToDOM('¡Ups! Mi horno está apagado. ¿Encendiste Ollama? 🥧', 'bot');
    }
}

// --- Funciones del Sidebar y UI ---
function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    renderSidebar(); // Asegurar que el sidebar esté actualizado
}

function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
}

menuBtn.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
});
closeSidebarBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);


function cambiarFondoPorReceta(respuestaBot){
    const texto = respuestaBot.toLowerCase();
    const fondo = document.getElementById('fondo');
    let nuevaImagen = 'imagenes/fondo4.jpeg'; // default

    if(texto.includes("chocolate") || texto.includes("brownies") || texto.includes("cafe")) nuevaImagen = "imagenes/chocolate.jpg";
    else if(texto.includes("limón") || texto.includes("naranja")) nuevaImagen = "imagenes/limon.jpg";
    else if(texto.includes("fresa") || texto.includes("fruta")) nuevaImagen = "imagenes/fresa.jpg";
    else if(texto.includes("oreo") || texto.includes("galleta")) nuevaImagen = "imagenes/oreo.jpg";
    else if(texto.includes("pan") || texto.includes("panes")) nuevaImagen = "imagenes/panaderia.jpg";
    else if(texto.includes("torta") || texto.includes("cumpleaños")) nuevaImagen = "imagenes/torta.jpg";

    // efecto fade
    fondo.classList.add('fade-out');
    setTimeout(() => {
        fondo.style.backgroundImage = `url('${nuevaImagen}')`;
        fondo.classList.remove('fade-out');
    }, 300); // la mitad de la transición
}

// --- Evento de nueva conversación ---
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        createNewConversation(true); // Crea con mensaje de bienvenida
        renderActiveConversation();
        renderSidebar();
        closeSidebar();
    });
}

// --- Evento del widget flotante ---
if (sweetieWidget) {
    sweetieWidget.addEventListener('click', () => {
        createNewConversation(true);
        renderActiveConversation();
        renderSidebar();
        openSidebar();
    });
}
// --- Eventos de envío de mensajes ---
sendBtn.addEventListener('click', sendToOllama);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendToOllama();
});

// --- Inicialización ---
window.addEventListener('load', () => {
    loadFromStorage();
});

// --- Expandir chat formato  ---
if (expandBtn) {
    expandBtn.addEventListener('click', () => {

        chatContainer.classList.toggle('expanded');

        const icon = expandBtn.querySelector('i');

        if (chatContainer.classList.contains('expanded')) {
            icon.classList.remove('fa-expand');
            icon.classList.add('fa-compress');
        } else {
            icon.classList.remove('fa-compress');
            icon.classList.add('fa-expand');
        }

    });
}