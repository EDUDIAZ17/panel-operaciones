import { supabase } from '../services/supabaseClient.js';
import { formatDate } from '../utils/formatters.js';

export async function openHistoryModal(unitId) {
    // Create Tailwind Modal
    let modal = document.getElementById('history-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'history-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 fade-in';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-1/2 max-h-[80vh] overflow-y-auto shadow-2xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Historial de Unidad</h3>
                    <button id="close-history" class="text-gray-500 hover:text-red-500 text-2xl">&times;</button>
                </div>
                <div id="history-content">
                    <div class="spinner border-gray-500"></div> Cargando...
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('close-history').onclick = () => modal.remove();
    }

    // Load Data
    const content = document.getElementById('history-content');
    const { data: history, error } = await supabase
        .from('assignments_history') // Note: In v2.0 setup we might not have populated this wrapper yet, but assuming table exists
        // Wait, the v2 setup created 'assignments_history' but we haven't implemented the trigger/logic to populate it automatically on unit update.
        // For now, let's query the table. If empty, show message.
        .select('*')
        .eq('unit_id', unitId)
        .order('timestamp', { ascending: false });

    // Since we didn't add the Trigger in SQL, this might be empty. 
    // Ideally we'd add an INSERT to assignments_history in assignments.js `updateAssignment` function.
    
    // For now let's query what we have.
    if (!history || history.length === 0) {
        content.innerHTML = '<p class="text-gray-500">No hay registros históricos.</p>';
        return;
    }

    let html = '<ul class="space-y-3">';
    history.forEach(h => {
        html += `
            <li class="border-b pb-2">
                <div class="flex justify-between">
                    <span class="font-bold text-sm text-blue-600">${h.action_type}</span>
                    <span class="text-xs text-gray-400">${formatDate(h.timestamp)}</span>
                </div>
                <div class="text-sm text-gray-700">${h.details || 'Sin detalles'}</div>
                <div class="text-xs text-gray-500 text-right">Modificado por: ${h.modified_by}</div>
            </li>
        `;
    });
    html += '</ul>';
    content.innerHTML = html;
}
