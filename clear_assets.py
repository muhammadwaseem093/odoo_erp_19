import psycopg2

conn = psycopg2.connect(
    host='192.168.0.103',
    port=5432,
    user='odoo_dev_user',
    password='admin123',
    dbname='odoo_local'
)
cur = conn.cursor()

# Clear asset attachments
cur.execute("DELETE FROM ir_attachment WHERE url LIKE '/web/assets/%'")
print(f'Deleted {cur.rowcount} asset attachments')

# Clear asset cache
cur.execute("DELETE FROM ir_attachment WHERE name LIKE '%.assets_%'")
print(f'Deleted {cur.rowcount} additional asset attachments')

conn.commit()
conn.close()
print('Done! Restart Odoo and hard refresh browser.')
