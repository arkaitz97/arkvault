import db from '../server/db.js';

console.log('Resetting admin user...');
try {
    const defaultHash = '$2b$10$w1QUlPvwXKkY4.Ax2oH1N.z1UzlH2npyT75zSJAL9txWqz.auUWv.';
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE username = 'admin'").run(defaultHash);
    console.log('Admin user reset to default (admin123, must change).');
} catch (error) {
    console.error('Error resetting DB:', error);
}
