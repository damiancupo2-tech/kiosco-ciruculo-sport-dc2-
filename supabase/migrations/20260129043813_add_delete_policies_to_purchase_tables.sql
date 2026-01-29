/*
  # Add DELETE policies to purchase tables

  1. Changes
    - Add DELETE policy to purchase_invoices table
    - Add DELETE policy to purchase_invoice_items table
    - Add DELETE policy to inventory_movements table
  
  2. Security
    - Allow anonymous and authenticated users to delete records
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_invoices' 
    AND policyname = 'Anyone can delete purchase_invoices'
  ) THEN
    CREATE POLICY "Anyone can delete purchase_invoices"
      ON purchase_invoices
      FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_invoice_items' 
    AND policyname = 'Anyone can delete purchase_invoice_items'
  ) THEN
    CREATE POLICY "Anyone can delete purchase_invoice_items"
      ON purchase_invoice_items
      FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inventory_movements' 
    AND policyname = 'Anyone can delete inventory_movements'
  ) THEN
    CREATE POLICY "Anyone can delete inventory_movements"
      ON inventory_movements
      FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;
END $$;