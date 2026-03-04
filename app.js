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

// Historial de la conversación (Carga de localStorage o inicia nuevo)
let messages = JSON.parse(localStorage.getItem('sweetie_messages')) || [
    {
        role: 'system',
        content: `Eres Sweetie, una chef pastelera experta con 20 años de experiencia. 
        Tu misión es dar recetas de postres claras, cortas y directas.
        DEBES seguir estas reglas estrictamente:
        1. Formato: INGREDIENTES (con guiones) y PROCEDIMIENTO (numerado).
        2. Si el usuario te da ingredientes, recomiéndale qué postre puede hacer.
        3. Responde en español, con tono amigable y emojis.`
    }
];

// --- FUNCIONES DE PERSISTENCIA ---
function saveToLocalStorage() {
    localStorage.setItem('sweetie_messages', JSON.stringify(messages));
    localStorage.setItem('sweetie_sidebar', conversationList.innerHTML);
    localStorage.setItem('sweetie_chat_html', chatBox.innerHTML);
}

function loadFromLocalStorage() {
    const savedSidebar = localStorage.getItem('sweetie_sidebar');
    const savedChat = localStorage.getItem('sweetie_chat_html');
    
    if (savedSidebar) conversationList.innerHTML = savedSidebar;
    if (savedChat) {
        chatBox.innerHTML = savedChat;
        chatBox.scrollTop = chatBox.scrollHeight;
        rebindSidebarEvents(); // Re-vincula los clics a los items cargados
    } else {
        addMessage('Hola, soy Sweetie ¿Qué postre te gustaría preparar hoy? ✨', 'bot');
    }
}

// Re-vincula el evento de scroll a los items que cargamos del almacenamiento
function rebindSidebarEvents() {
    const items = conversationList.querySelectorAll('.conversation-item');
    items.forEach(item => {
        item.onclick = function() {
            // El ID se guarda en el texto o estructura, aquí lo recuperamos de un atributo si lo deseas
            // Para simplicidad en esta versión, buscamos por el texto que guardamos
            const textSnippet = item.querySelector('.convo-name').textContent;
            const messagesInDom = chatBox.querySelectorAll('.user-message');
            for (let msg of messagesInDom) {
                if (msg.textContent.includes(textSnippet.replace('...', ''))) {
                    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    msg.style.backgroundColor = '#333';
                    setTimeout(() => msg.style.backgroundColor = '', 1000);
                    closeSidebar();
                    break;
                }
            }
        };
    });
}

// --- Funciones del Sidebar y UI ---
function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
}

menuBtn.addEventListener('click', openSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

// --- FUNCIÓN PARA ACTUALIZAR EL HISTORIAL EN EL SIDEBAR ---
function updateSidebarHistory(text, messageId) {
    if (!conversationList) return;

    const item = document.createElement('div');
    item.className = 'conversation-item'; 
    
    item.innerHTML = `
        <span class="convo-icon">🧁</span>
        <div class="convo-info">
            <span class="convo-name">${text.length > 20 ? text.substring(0, 20) + '...' : text}</span>
            <span class="convo-preview">Ver receta...</span>
        </div>
    `;

    item.addEventListener('click', () => {
        const targetMessage = document.getElementById(messageId);
        if (targetMessage) {
            targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetMessage.style.backgroundColor = '#333';
            setTimeout(() => targetMessage.style.backgroundColor = '', 1000);
            closeSidebar();
        }
    });
    
    conversationList.prepend(item);
    saveToLocalStorage();
}

// --- Función para formatear texto del bot ---
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

// --- Lógica de Mensajes ---
function addMessage(text, sender, messageId = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    
    if (messageId) messageDiv.id = messageId;

    if (sender === 'bot') {
        messageDiv.innerHTML = formatBotText(text);
    } else {
        messageDiv.textContent = text;
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    saveToLocalStorage();
}

function trimHistory() {
    const MAX_HISTORY = 10; // Aumentado para mejor persistencia
    if (messages.length > MAX_HISTORY + 1) {
        messages = [messages[0], ...messages.slice(-MAX_HISTORY)];
    }
}

async function sendToOllama() {
    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    const messageId = 'msg-' + Date.now();
    addMessage(userMessage, 'user', messageId);
    userInput.value = '';
    
    messages.push({ role: 'user', content: userMessage });
    updateSidebarHistory(userMessage, messageId);

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
                messages: messages,
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

        const thinkingElement = document.getElementById('thinking');
        if (thinkingElement) thinkingElement.remove();

        addMessage(botReply, 'bot');
        messages.push({ role: 'assistant', content: botReply });
        trimHistory();
        saveToLocalStorage();

    } catch (error) {
        const thinkingElement = document.getElementById('thinking');
        if (thinkingElement) thinkingElement.remove();
        addMessage('¡Ups! Mi horno está apagado. ¿Encendiste Ollama? 🥧', 'bot');
    }
}

// Eventos
sendBtn.addEventListener('click', sendToOllama);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendToOllama();
});

// LÓGICA PARA NUEVA CONVERSACIÓN
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        localStorage.clear(); // Limpia todo el almacenamiento
        messages = [{
            role: 'system',
            content: messages[0].content
        }]; 
        chatBox.innerHTML = ''; 
        if(conversationList) conversationList.innerHTML = ''; 
        addMessage('¡Horno limpio! Nueva conversasión iniciada. ✨', 'bot');
        closeSidebar();
    });
}

// Cargar datos al iniciar
window.addEventListener('load', () => {
    chatBox.innerHTML = ''; 
    loadFromLocalStorage();
});