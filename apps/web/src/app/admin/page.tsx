import Link from 'next/link';

export default function AdminHome() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Beheer</h1>
      <p className="text-gray-600">
        Stel hier je strippenkaarten, abonnementen, lestypes en rooster in. Wijzigingen
        worden direct zichtbaar op de prijzen- en rooster-pagina én in de embed-widget.
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          ['/admin/passes', 'Strippenkaarten', 'Off Peak 15, Bundel 30, Bundel 60, …'],
          ['/admin/subscriptions', 'Abonnementen', 'Starter, Flex, …'],
          ['/admin/activities', 'Lestypes', 'Reformer, Barre, Yoga, DUO'],
          ['/admin/instructors', 'Instructeurs', 'Wie geeft de les'],
          ['/admin/rooms', 'Ruimtes', 'Reformer-zaal, Mat-zaal, …'],
          ['/admin/classes', 'Rooster', 'Plan klassen in'],
          ['/admin/classes/recurring', 'Bulk plannen', 'Een hele week of maand in één keer'],
          ['/admin/bookings', 'Boekingen', 'Wie zit in welke les + wachtlijst'],
          ['/admin/orders', 'Betalingen', 'Mollie-orders, status, factuurnummers'],
          ['/admin/team', 'Team', 'Andere admins uitnodigen'],
        ].map(([href, title, sub]) => (
          <li key={href}>
            <Link href={href} className="block border rounded-2xl p-5 hover:bg-gray-50">
              <div className="font-medium">{title}</div>
              <div className="text-sm text-gray-500">{sub}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
