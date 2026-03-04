/*
    Lógica principal
    Maneja la interacción con Ollama, la gestión de conversaciones múltiples,
    la persistencia y la interfaz de usuario dinámica.
    
*/


// Configuración de Ollama
const API_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma3:1b';

// Elementos del DOM
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

// --- REFERENCIAS PARA EL HISTORIAL ---
const conversationList = document.getElementById('conversation-list');
const newChatBtn = document.getElementById('newChatBtn');

// System prompt base (se usará en todas las conversaciones)
const SYSTEM_PROMPT = `Eres Sweetie, una chef pastelera experta con 20 años de experiencia. 
Tu misión es dar recetas de postres claras, cortas y directas.
DEBES seguir estas reglas estrictamente:
1. Formato: INGREDIENTES (con guiones) y PROCEDIMIENTO (numerado).
2. Si el usuario te da ingredientes, recomiéndale qué postre puede hacer.
3. Responde en español, con tono amigable y emojis.`;

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
        `;
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

menuBtn.addEventListener('click', openSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

// --- Evento de nueva conversación ---
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        createNewConversation(true); // Crea con mensaje de bienvenida
        renderActiveConversation();
        renderSidebar();
        closeSidebar();
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