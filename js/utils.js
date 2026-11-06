const SUPABASE_URL = 'https://ygxwvmhdpqbumstoqayg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F05L1QI1ClkusTzEaBzoyQ_3YcYAaOn';

window.supabaseClient = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const db = window.supabaseClient;

const pronounOrder = ['მე', 'ჩვენ', 'შენ', 'თქვენ', 'ის', 'მას', 'მან', 'ისინი', 'მათ'];
const screeveOrder = ['present', 'imperfect', 'future', 'conditional', 'aorist', 'optative', 'perfective'];

function getPronounRank(val) {
    if (!val) return 99;
    const index = pronounOrder.indexOf(val.trim());
    return index !== -1 ? index : 50;
}

function getScreeveRank(screeve) {
    if (!screeve) return 99;
    const index = screeveOrder.indexOf(screeve.toLowerCase().trim());
    return index !== -1 ? index : 50;
}

function formatStatus(status) {
    if (!status) return '';
    return status.replace('_', ' ');
}