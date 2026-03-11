// edy_voice.js - Web Speech API Integration

export function initVoiceAssistant() {
    const btnVoice = document.getElementById('btn-voice');
    const tooltip = document.getElementById('voice-tooltip');
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        btnVoice.classList.add('hidden');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let isListening = false;

    btnVoice.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = function() {
        isListening = true;
        btnVoice.classList.add('listening');
        tooltip.textContent = "Escuchando...";
        tooltip.style.opacity = '1';
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript.toLowerCase();
        tooltip.textContent = `"${transcript}"`;
        handleCommand(transcript);
        
        setTimeout(() => {
            tooltip.style.opacity = '0';
        }, 3000);
    };

    recognition.onerror = function(event) {
        console.error("Voice error:", event.error);
        tooltip.textContent = "Error al escuchar";
        setTimeout(() => tooltip.style.opacity = '0', 2000);
    };

    recognition.onend = function() {
        isListening = false;
        btnVoice.classList.remove('listening');
    };

    // Sugerencias periódicas
    setInterval(() => {
        if (!isListening && Math.random() > 0.7) {
            tooltip.textContent = '"¿Falta mucho?"';
            tooltip.style.opacity = '1';
            setTimeout(() => tooltip.style.opacity = '0', 4000);
        }
    }, 15000);
}

function handleCommand(command) {
    if (command.includes('falta') || command.includes('tiempo') || command.includes('llegar')) {
        const timeLeft = document.getElementById('telemetry-time-left').textContent;
        speakText(`Te faltan aproximadamente ${timeLeft} para el destino.`);
    } 
    else if (command.includes('caseta') || command.includes('peaje') || command.includes('cobro')) {
        const tollName = document.getElementById('next-toll-name').textContent;
        const tollCost = document.getElementById('next-toll-cost').textContent;
        speakText(`La próxima caseta es ${tollName} con un costo estimado de ${tollCost}.`);
    }
    else if (command.includes('seguridad') || command.includes('robo') || command.includes('peligro')) {
        document.getElementById('btn-hotspots').click();
        speakText(`Activando capa de riesgo en tiempo real.`);
    }
    else if (command.includes('paradero') || command.includes('descansar') || command.includes('dormir')) {
        document.getElementById('btn-safe-stops').click();
        speakText(`Mostrando paraderos certificados seguros.`);
    }
    else {
        speakText('No entendí el comando. Intenta preguntar por el tiempo o casetas.');
    }
}

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 1.1; // Un poco más rápido
    
    // Obtener voz de google si está disponible
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.includes('es-') && (v.name.includes('Google') || v.name.includes('Natural')));
    if (esVoice) utterance.voice = esVoice;

    window.speechSynthesis.speak(utterance);
}

// Cargar voces en Chrome
window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};
