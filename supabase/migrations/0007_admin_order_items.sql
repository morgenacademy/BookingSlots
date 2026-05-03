-- Admin Betalingen page joins order_items, but the original migration only
-- granted read on items the user themselves bought. Allow studio admins to
-- read every order item on their studio's orders.
create policy "admin all order_items" on order_items
  for all using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id and is_studio_admin(o.studio_id)
    )
  ) with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id and is_studio_admin(o.studio_id)
    )
  );
