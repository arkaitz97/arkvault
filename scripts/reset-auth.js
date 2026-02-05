import db from '../server/db.js';

console.log('Resetting auth settings...');
try {
    const defaultHash = '$2b$10$w1QUlPvwXKkY4.Ax2oH1N.z1UzlH2npyT75zSJAL9txWqz.auUWv.'; // admin123
    db.prepare('UPDATE auth_settings SET password_hash = ?, must_change_password = 1 WHERE id = 1').run(defaultHash);
    console.log('Auth settings reset to default (admin123, must change).');
} catch (error) {
    console.error('Error resetting DB:', error);
}
